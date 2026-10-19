<?php

namespace App\DTOs;

readonly class DocumentSearchData
{
    public function __construct(
        public string $query,
        public int $limit = 5,
        public float $minSimilarity = 0.4,
    ) {}
}
