<div
    class="wm-modal"
    data-wire-component="modal"
    data-wm-name="{{ $name }}"
    data-wm-size="{{ $size }}"
    @if($fullscreen) data-wm-fullscreen="true" @endif
    @if($persistent) data-wm-persistent="true" @endif
    @isset($nav) data-wm-nav="true" @endisset
    data-wm-state="{{ $show ? 'open' : 'closed' }}"
    @if($triggerEvent) data-wm-trigger="{{ $triggerEvent }}" @endif
    role="dialog"
    aria-modal="true"
    aria-hidden="{{ $show ? 'false' : 'true' }}"
    @if($title) aria-label="{{ $title }}" @endif
    wire:ignore.self
>
    <div class="wm-overlay" data-wm-dismiss></div>

    <{{ $as }} {{ $attributes->merge(['class' => 'wm-panel']) }} role="document">
        {{-- With a `nav` slot the panel becomes two columns and the nav runs the
             full height, so the sections stay in place while the content scrolls.
             The header then belongs to the content column, not to the whole panel. --}}
        @isset($nav)
            <nav class="wm-nav" aria-label="{{ $title ?: 'Sections' }}">
                {{ $nav }}
            </nav>
        @endisset

        <div class="wm-content">
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
    </{{ $as }}>
</div>
