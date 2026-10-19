<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Laravel\Ai\Transcription;

class AudioService
{
    public function transcribe(UploadedFile $file): string
    {
        $transcript = Transcription::fromUpload($file)->generate();

        return (string) $transcript;
    }
}
