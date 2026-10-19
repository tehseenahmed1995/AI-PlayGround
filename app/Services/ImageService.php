<?php

namespace App\Services;

use Laravel\Ai\Image;

class ImageService
{
    public function generate(string $prompt, string $size = 'square'): array
    {
        $image = Image::of($prompt);

        $image = match ($size) {
            'landscape' => $image->landscape(),
            'portrait' => $image->portrait(),
            default => $image->square(),
        };

        $generated = $image->generate();
        $path = $generated->storePublicly();

        return [
            'path' => $path,
            'url' => asset('storage/' . $path),
        ];
    }
}
