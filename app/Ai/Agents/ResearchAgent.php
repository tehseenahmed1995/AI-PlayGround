<?php

namespace App\Ai\Agents;

use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;
use Stringable;

#[Model('llama3.2:3b')]
#[MaxTokens(4096)]
#[Temperature(0.5)]
class ResearchAgent implements Agent
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
You are a research assistant. When asked a question:

1. Provide a thorough, well-researched answer based on your knowledge.
2. Structure your response with clear sections and key takeaways.
3. If the topic involves recent events beyond your training data, clearly state that.
4. Cite relevant concepts, frameworks, or sources where applicable.
5. Present findings in a readable format with bullet points for key takeaways.
6. Be comprehensive but concise.
PROMPT;
    }
}
