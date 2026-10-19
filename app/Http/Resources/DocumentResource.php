<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content' => $this->content,
            'chunk_index' => $this->chunk_index,
            'original_filename' => $this->original_filename,
            'created_at' => $this->created_at,
        ];
    }
}
