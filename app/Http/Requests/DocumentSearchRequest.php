<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DocumentSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'query' => ['required', 'string', 'max:1000'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
            'min_similarity' => ['nullable', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
