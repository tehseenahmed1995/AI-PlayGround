<?php

namespace App\Services;

use App\Ai\Agents\ResearchAgent;

class ResearchService
{
    public function research(string $question): mixed
    {
        return (new ResearchAgent)->stream(
            "Research the following question and provide a comprehensive answer:\n\n{$question}"
        );
    }
}
