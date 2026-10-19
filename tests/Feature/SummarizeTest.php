<?php

namespace Tests\Feature;

use App\Ai\Agents\SummarizerAgent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SummarizeTest extends TestCase
{
    use RefreshDatabase;

    public function test_summarize_requires_text(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/summarize', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['text']);
    }

    public function test_summarize_returns_summary(): void
    {
        SummarizerAgent::fake(['This is a concise summary.']);

        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/summarize', [
                'text' => 'This is a very long text that needs to be summarized into something shorter and more concise.',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['summary']);
    }
}
