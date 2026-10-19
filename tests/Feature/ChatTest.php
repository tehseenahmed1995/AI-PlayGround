<?php

namespace Tests\Feature;

use App\Ai\Agents\SupportAgent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_chat_requires_message(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/chat', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['message']);
    }

    public function test_chat_sends_message(): void
    {
        SupportAgent::fake(['Hello! How can I help you?']);

        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/chat', ['message' => 'Hello']);

        $response->assertOk();
    }

    public function test_chat_history_returns_conversations(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->getJson('/api/chat/history');

        $response->assertOk()
            ->assertJsonStructure(['conversations']);
    }
}
