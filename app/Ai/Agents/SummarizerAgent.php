<?php

namespace App\Ai\Agents;

use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;
use Stringable;

#[Model('llama3.2:3b')]
#[MaxTokens(2048)]
#[Temperature(0.3)]
class SummarizerAgent implements Agent
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
You are a text summarization expert. Your job is to:
- Condense the provided text into a clear, concise summary.
- Preserve the key points and main ideas.
- Maintain the original tone and intent.
- Use bullet points for multiple key takeaways when appropriate.
- Keep the summary to roughly 20-30% of the original length.
PROMPT;
    }
}
