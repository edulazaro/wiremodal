<?php

namespace EduLazaro\Wiremodal\Components;

use Illuminate\Support\Str;
use Illuminate\View\Component;
use InvalidArgumentException;

class Modal extends Component
{
    public string $name;
    public string $title;
    public string $size;
    public bool $fullscreen;
    public bool $closable;
    public bool $persistent;
    public bool $show;
    public ?string $triggerEvent;
    public string $as;

    /**
     * Size catalog. Keep in sync with wiremodal.css `[data-wm-size="..."]` selectors.
     */
    public const SIZES = [
        'xs'  => '20rem',
        'sm'  => '24rem',
        'md'  => '28rem',
        'lg'  => '32rem',
        'xl'  => '36rem',
        '2xl' => '42rem',
        '3xl' => '48rem',
        '4xl' => '56rem',
        '5xl' => '64rem',
        '6xl' => '72rem',
        '7xl' => '80rem',
    ];

    /**
     * Tags allowed for the modal panel. `div` is the default; `form` makes the
     * panel render as `<form>` so consumers can attach `wire:submit` / native
     * submit semantics (Enter key, type="submit" buttons in footer slot).
     */
    public const ALLOWED_AS = ['div', 'form'];

    public function __construct(
        string $name = '',
        string $title = '',
        string $size = '2xl',
        bool $fullscreen = false,
        bool $closable = true,
        bool $persistent = false,
        bool $show = false,
        ?string $triggerEvent = null,
        string $as = 'div',
    ) {
        $this->name = $name !== '' ? $name : (string) Str::uuid();
        $this->title = $title;
        $this->size = $this->validateSize($size);
        $this->fullscreen = $fullscreen;
        $this->closable = $closable;
        $this->persistent = $persistent;
        $this->show = $show;
        $this->triggerEvent = $triggerEvent;
        $this->as = $this->validateAs($as);
    }

    protected function validateAs(string $as): string
    {
        if (!in_array($as, self::ALLOWED_AS, true)) {
            throw new InvalidArgumentException(
                "Invalid wiremodal as '{$as}'. Allowed: " . implode(', ', self::ALLOWED_AS)
            );
        }

        return $as;
    }

    protected function validateSize(string $size): string
    {
        if (!array_key_exists($size, self::SIZES)) {
            throw new InvalidArgumentException(
                "Invalid wiremodal size '{$size}'. Allowed: " . implode(', ', array_keys(self::SIZES))
            );
        }

        return $size;
    }

    public function render()
    {
        return view('wiremodal::components.wiremodal');
    }
}
