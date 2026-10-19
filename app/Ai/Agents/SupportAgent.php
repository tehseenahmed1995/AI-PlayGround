<?php

namespace App\Ai\Agents;

use App\Models\User;
use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Promptable;
use Stringable;

#[Model('llama3.2:3b')]
#[MaxTokens(4096)]
#[Temperature(0.7)]
class SupportAgent implements Agent, Conversational
{
    use Promptable, RemembersConversations;

    public function __construct(public ?User $user = null) {}

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
You are an expert programming assistant specializing in Laravel, PHP, and modern web development.

Guidelines:
- Provide clear, concise, and accurate answers to programming questions.
- Include code examples when helpful, using proper formatting.
- Explain concepts step by step when the question is complex.
- If you're unsure about something, say so rather than guessing.
- Focus on best practices, performance, and security.
- Be friendly and encouraging to developers of all skill levels.
PROMPT;
    }
}
