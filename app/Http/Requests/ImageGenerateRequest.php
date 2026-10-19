<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImageGenerateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prompt' => ['required', 'string', 'max:4000'],
            'size' => ['nullable', 'string', 'in:square,landscape,portrait'],
        ];
    }
}
