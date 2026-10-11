/*!
 * wiremodal - framework-agnostic modal controller
 * Listens for window events and updates [data-wm-state] attribute.
 *
 * Open:   Wiremodal.open('modal-name')
 *         Wiremodal.open('modal-name', { id: 42 })                                            // with payload
 *         window.dispatchEvent(new CustomEvent('open-wiremodal',  { detail: 'modal-name' }))
 *         window.dispatchEvent(new CustomEvent('open-wiremodal',  { detail: { name: 'modal-name', data: { id: 42 } } }))
 *         window.dispatchEvent(new CustomEvent('open-modal',      { detail: 'modal-name' }))  // legacy alias
 *
 * Close:  Wiremodal.close('modal-name')
 *         Wiremodal.closeAll()
 *         window.dispatchEvent(new CustomEvent('close-wiremodal', { detail: 'modal-name' }))
 *         window.dispatchEvent(new CustomEvent('close-modal',     { detail: 'modal-name' }))  // legacy alias
 *
 * Lifecycle events on both modal element and window:
 *   wiremodal:beforeclose  - cancelable. preventDefault() blocks the close.
 *   wiremodal:opened       - detail = { name, data }
 *   wiremodal:closed       - detail = { name, result } (result passed to Wiremodal.close(name, result))
 *
 * Promise API: Wiremodal.open(name, data?) returns a Promise that resolves with the
 *   value passed to Wiremodal.close(name, result) - useful for sequential flows.
 *
 * Persistent: modals rendered with data-wm-persistent="true" ignore overlay clicks
 *   and ESC. They only close via explicit buttons or programmatic close().
 *
 * Trigger from inside markup: any element with `data-wm-dismiss` inside a modal closes that modal.
 */
(function () {
    'use strict';

    const STATE_OPEN = 'open';
    const STATE_CLOSED = 'closed';
    const BODY_LOCK_CLASS = 'wm-no-scroll';
    const BACKDROP_ID = 'wm-backdrop';

    const focusReturn = new WeakMap();
    const pendingResolvers = new Map();  // name -> resolver function for Wiremodal.open() Promise

    function findModal(name) {
        if (!name) return null;
        try {
            return document.querySelector(`.wm-modal[data-wm-name="${CSS.escape(name)}"]`);
        } catch (e) {
            return null;
        }
    }

    function focusables(modal) {
        return Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]):not([data-wm-dismiss]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
    }

    function lockBodyIfNeeded() {
        document.body.classList.add(BODY_LOCK_CLASS);
    }

    function unlockBodyIfNoneOpen() {
        const stillOpen = document.querySelector('.wm-modal[data-wm-state="open"]');
        if (!stillOpen) {
            document.body.classList.remove(BODY_LOCK_CLASS);
        }
    }

    /**
     * ONE backdrop for the whole page, created here and parented to the body.
     *
     * Each modal used to paint its own, which cost three things. Two modals open at
     * once dimmed the page twice. The node lived inside a Livewire component, so a
     * re-render morphed it and it came back without its transition, which read as a
     * flash. And being inside the page it inherited whatever containing block an
     * ancestor with `transform` imposed, so it covered that ancestor's box instead of
     * the viewport. On the body, under no component, none of that applies.
     */
    function backdrop() {
        let el = document.getElementById(BACKDROP_ID);

        if (!el) {
            el = document.createElement('div');
            el.id = BACKDROP_ID;
            el.className = 'wm-backdrop';
            el.setAttribute('data-wm-state', STATE_CLOSED);
            el.addEventListener('click', () => {
                const top = topMostOpen();
                if (top && top.getAttribute('data-wm-persistent') !== 'true') {
                    setState(top, STATE_CLOSED, undefined, undefined, 'dismiss');
                }
            });
            document.body.appendChild(el);
        }

        return el;
    }

    // The last one opened, which is the one on top and the one Escape and the
    // backdrop act on.
    function topMostOpen() {
        const open = document.querySelectorAll('.wm-modal[data-wm-state="open"]');
        return open.length ? open[open.length - 1] : null;
    }

    function syncBackdrop() {
        const top = topMostOpen();
        const el = backdrop();

        el.setAttribute('data-wm-state', top ? STATE_OPEN : STATE_CLOSED);

        // El tema viaja con el fundido. Vive en el body, asi que solo hereda lo que
        // declare el <html>: una modal con su propio tema en un envoltorio (lo
        // normal cuando una pantalla concreta se sale del tema de la aplicacion) se
        // quedaba con el fundido del documento, de otro color que ella.
        const theme = top && top.closest('[data-wire-theme]');

        if (theme) {
            el.setAttribute('data-wire-theme', theme.getAttribute('data-wire-theme'));
        } else {
            el.removeAttribute('data-wire-theme');
        }

        const mode = top && top.closest('[data-wire-theme-mode]');

        if (mode) {
            el.setAttribute('data-wire-theme-mode', mode.getAttribute('data-wire-theme-mode'));
        } else {
            el.removeAttribute('data-wire-theme-mode');
        }
    }

    // Returns true if the close happened, false if cancelled by beforeclose handler.
    function setState(modal, state, data, result, reason) {
        if (!modal) return false;
        const previous = modal.getAttribute('data-wm-state');
        if (previous === state) return false;
        const name = modal.getAttribute('data-wm-name');

        if (state === STATE_CLOSED) {
            // Cancelable beforeclose hook
            const beforeDetail = { name, reason: reason || 'programmatic' };
            const beforeEvt = new CustomEvent('wiremodal:beforeclose', { bubbles: true, cancelable: true, detail: beforeDetail });
            const proceedOnModal = modal.dispatchEvent(beforeEvt);
            const winEvt = new CustomEvent('wiremodal:beforeclose', { cancelable: true, detail: beforeDetail });
            const proceedOnWin = window.dispatchEvent(winEvt);
            if (!proceedOnModal || !proceedOnWin) return false;
        }

        modal.setAttribute('data-wm-state', state);
        modal.setAttribute('aria-hidden', state === STATE_CLOSED ? 'true' : 'false');
        syncBackdrop();

        if (state === STATE_OPEN) {
            // A modal opened over another hides the one underneath instead of stacking
            // on top of it. Two dialogs at once are two sets of buttons for one
            // decision, and the one below is unreachable anyway; hiding it also means
            // the z-index of whatever else is on the page stops mattering.
            document.querySelectorAll('.wm-modal[data-wm-state="open"]').forEach(other => {
                if (other !== modal) other.setAttribute('data-wm-covered', 'true');
            });
            modal.removeAttribute('data-wm-covered');

            focusReturn.set(modal, document.activeElement);
            lockBodyIfNeeded();
            setTimeout(() => {
                // Honor explicit [autofocus] inside the modal; fall back to first focusable.
                const explicit = modal.querySelector('[autofocus]:not([disabled])');
                const first = explicit || focusables(modal)[0];
                if (first) first.focus();
            }, 60);
            const detail = { name, data: data || {} };
            modal.dispatchEvent(new CustomEvent('wiremodal:opened', { bubbles: true, detail }));
            window.dispatchEvent(new CustomEvent('wiremodal:opened', { detail }));
        } else {
            // Closing the top one brings back the last that was covered by it.
            modal.removeAttribute('data-wm-covered');
            const covered = Array.from(document.querySelectorAll('.wm-modal[data-wm-covered="true"]'));
            const last = covered[covered.length - 1];
            if (last) last.removeAttribute('data-wm-covered');

            unlockBodyIfNoneOpen();
            const previousFocus = focusReturn.get(modal);
            if (previousFocus && typeof previousFocus.focus === 'function') {
                try { previousFocus.focus(); } catch (e) { /* noop */ }
            }
            const detail = { name, result };
            modal.dispatchEvent(new CustomEvent('wiremodal:closed', { bubbles: true, detail }));
            window.dispatchEvent(new CustomEvent('wiremodal:closed', { detail }));

            // Resolve any pending Wiremodal.open() Promise for this modal
            const resolver = pendingResolvers.get(name);
            if (resolver) {
                pendingResolvers.delete(name);
                resolver(result);
            }
        }
        return true;
    }

    // Returns a Promise that resolves when the modal closes. The resolved value is whatever
    // was passed as `result` to close(). Opening an already-open modal still returns a Promise
    // tied to its eventual close.
    function open(name, data) {
        const modal = findModal(name);
        if (!modal) return Promise.resolve(undefined);
        return new Promise((resolve) => {
            // If a prior Promise existed (re-open before close), resolve it with undefined
            const previous = pendingResolvers.get(name);
            if (previous) previous(undefined);
            pendingResolvers.set(name, resolve);
            setState(modal, STATE_OPEN, data);
        });
    }
    function close(name, result) { return setState(findModal(name), STATE_CLOSED, undefined, result, 'programmatic'); }
    function closeAll() {
        document.querySelectorAll('.wm-modal[data-wm-state="open"]').forEach(m => setState(m, STATE_CLOSED, undefined, undefined, 'programmatic'));
    }
    function isOpen(name) {
        const m = findModal(name);
        return !!m && m.getAttribute('data-wm-state') === STATE_OPEN;
    }

    // Parse CustomEvent detail. Accepts:
    //   'name'                                 -> [name, undefined]
    //   { name: 'x' }                          -> ['x', undefined]
    //   { name: 'x', data: { id: 1 } }         -> ['x', { id: 1 }]
    function eventInfo(e) {
        if (!e || e.detail === undefined || e.detail === null) return [null, undefined];
        if (typeof e.detail === 'string') return [e.detail, undefined];
        if (typeof e.detail === 'object' && e.detail.name) return [e.detail.name, e.detail.data];
        return [null, undefined];
    }

    // Event API
    window.addEventListener('open-wiremodal',  e => { const [n, d] = eventInfo(e); if (n) open(n, d); });
    window.addEventListener('close-wiremodal', e => { const [n]    = eventInfo(e); if (n) close(n); });

    // Legacy aliases (compat with codebases that already use these event names)
    window.addEventListener('open-modal',  e => { const [n, d] = eventInfo(e); if (n) open(n, d); });
    window.addEventListener('close-modal', e => { const [n]    = eventInfo(e); if (n) close(n); });

    // Dismiss via [data-wm-dismiss] click (overlay or close button).
    // Persistent modals ignore overlay clicks but honor explicit dismiss elements (close X, cancel button).
    document.addEventListener('click', (e) => {
        const dismiss = e.target.closest('[data-wm-dismiss]');
        if (!dismiss) return;
        const modal = dismiss.closest('.wm-modal');
        if (!modal) return;
        if (modal.getAttribute('data-wm-state') !== STATE_OPEN) return;

        const name = modal.getAttribute('data-wm-name');
        if (name) setState(modal, STATE_CLOSED, undefined, undefined, 'dismiss');
    });

    // ESC closes the top-most open modal - skipped for persistent modals.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const opens = document.querySelectorAll('.wm-modal[data-wm-state="open"]');
        if (!opens.length) return;
        const top = opens[opens.length - 1];
        if (top.getAttribute('data-wm-persistent') === 'true') return;
        setState(top, STATE_CLOSED, undefined, undefined, 'escape');
    });

    // Focus trap inside the top-most open modal
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const opens = document.querySelectorAll('.wm-modal[data-wm-state="open"]');
        if (!opens.length) return;
        const top = opens[opens.length - 1];
        const items = focusables(top);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    // Expose global API
    window.Wiremodal = Object.freeze({ open, close, closeAll, isOpen });
})();
