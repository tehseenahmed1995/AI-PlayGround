<?php

namespace App\DTOs;

readonly class ChatRequestData
{
    public function __construct(
        public string $message,
        public ?string $conversationId = null,
    ) {}
}
