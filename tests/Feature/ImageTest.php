<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Image;
use Tests\TestCase;

class ImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_image_generation_requires_prompt(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/image/generate', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['prompt']);
    }

    public function test_image_generation_validates_size(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/image/generate', [
                'prompt' => 'A cat',
                'size' => 'invalid',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['size']);
    }
}
