<div
    class="wm-modal"
    data-wire-component="modal"
    data-wm-name="{{ $name }}"
    data-wm-size="{{ $size }}"
    @if($fullscreen) data-wm-fullscreen="true" @endif
    @if($persistent) data-wm-persistent="true" @endif
    data-wm-state="{{ $show ? 'open' : 'closed' }}"
    @if($triggerEvent) data-wm-trigger="{{ $triggerEvent }}" @endif
    role="dialog"
    aria-modal="true"
    aria-hidden="{{ $show ? 'false' : 'true' }}"
    @if($title) aria-label="{{ $title }}" @endif
>
    <div class="wm-overlay" data-wm-dismiss></div>

    <div class="wm-panel" role="document">
        @if($title || isset($header))
            <div class="wm-header">
                @isset($header)
                    {{ $header }}
                @else
                    <h3 class="wm-title">{{ $title }}</h3>
                    @if($closable)
                        <button type="button" class="wm-close" data-wm-dismiss aria-label="Close">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
                                <path d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    @endif
                @endisset
            </div>
        @endif

        <div class="wm-body">
            {{ $body ?? $slot }}
        </div>

        @isset($footer)
            <div class="wm-footer">
                {{ $footer }}
            </div>
        @endisset
    </div>
</div>
