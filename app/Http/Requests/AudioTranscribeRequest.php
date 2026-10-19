<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AudioTranscribeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'audio' => ['required', 'file', 'mimes:mp3,wav,m4a,webm,ogg', 'max:25600'],
        ];
    }
}
