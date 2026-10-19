<?php

namespace App\Services;

use App\Ai\Agents\SummarizerAgent;

class SummarizeService
{
    public function summarize(string $text): string
    {
        $response = (new SummarizerAgent)->prompt(
            "Please summarize the following text:\n\n{$text}"
        );

        return (string) $response;
    }
}
