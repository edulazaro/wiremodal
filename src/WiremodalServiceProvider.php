<?php

namespace EduLazaro\Wiremodal;

use Illuminate\Support\ServiceProvider;
use Illuminate\View\Compilers\BladeCompiler;

class WiremodalServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'wiremodal');

        $this->publishes([
            __DIR__ . '/../resources/views' => resource_path('views/vendor/wiremodal'),
        ], 'wiremodal-views');

        $this->publishes([
            __DIR__ . '/../resources/css' => public_path('vendor/wiremodal/css'),
            __DIR__ . '/../resources/js'  => public_path('vendor/wiremodal/js'),
        ], 'wiremodal-assets');

        $this->publishes([
            __DIR__ . '/../resources/css'   => public_path('vendor/wiremodal/css'),
            __DIR__ . '/../resources/js'    => public_path('vendor/wiremodal/js'),
            __DIR__ . '/../resources/views' => resource_path('views/vendor/wiremodal'),
        ], 'wiremodal');

        $this->callAfterResolving(BladeCompiler::class, function (BladeCompiler $blade) {
            $blade->component(\EduLazaro\Wiremodal\Components\Modal::class, 'wiremodal');
        });

        $this->registerLivewireMacros();
    }

    protected function registerLivewireMacros(): void
    {
        if (! class_exists(\Livewire\Component::class)) {
            return;
        }

        \Livewire\Component::macro('openModal', function (string $name, array $data = []) {
            // Always use named args. Positional string dispatch is wrapped by
            // Livewire into an array (e.detail = ['name']), which wiremodal's
            // eventInfo does not match.
            $this->dispatch('open-wiremodal', name: $name, data: $data);
        });

        \Livewire\Component::macro('closeModal', function (string $name) {
            $this->dispatch('close-wiremodal', name: $name);
        });
    }
}
