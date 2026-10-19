<?php

namespace App\Services;

use App\DTOs\DocumentSearchData;
use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class DocumentService
{
    public function storeDocument(UploadedFile $file, User $user): Collection
    {
        $content = $this->extractContent($file);
        $chunks = $this->chunkText($content, 1000);
        $title = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        $documents = collect();

        foreach ($chunks as $index => $chunk) {
            $embedding = Str::of($chunk)->toEmbeddings();

            $documents->push(Document::create([
                'user_id' => $user->id,
                'title' => $title,
                'content' => $chunk,
                'chunk_index' => $index,
                'original_filename' => $file->getClientOriginalName(),
                'embedding' => $embedding,
            ]));
        }

        return $documents;
    }

    public function search(DocumentSearchData $data, User $user): Collection
    {
        return Document::query()
            ->where('user_id', $user->id)
            ->whereVectorSimilarTo('embedding', $data->query, minSimilarity: $data->minSimilarity)
            ->limit($data->limit)
            ->get();
    }

    public function getUserDocuments(User $user): Collection
    {
        return Document::where('user_id', $user->id)
            ->select('id', 'title', 'original_filename', 'chunk_index', 'created_at')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('original_filename')
            ->map(fn ($chunks) => [
                'title' => $chunks->first()->title,
                'filename' => $chunks->first()->original_filename,
                'chunks' => $chunks->count(),
                'uploaded_at' => $chunks->first()->created_at,
            ])
            ->values();
    }

    private function extractContent(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());

        return match ($extension) {
            'txt', 'md', 'csv' => file_get_contents($file->getRealPath()),
            'pdf' => $this->extractPdfText($file),
            default => file_get_contents($file->getRealPath()),
        };
    }

    private function extractPdfText(UploadedFile $file): string
    {
        // Basic PDF text extraction using pdftotext if available,
        // otherwise fall back to reading raw content
        $path = $file->getRealPath();

        if (function_exists('shell_exec')) {
            $text = shell_exec("pdftotext {$path} -");
            if ($text) {
                return $text;
            }
        }

        return file_get_contents($path);
    }

    private function chunkText(string $text, int $chunkSize): array
    {
        $words = preg_split('/\s+/', trim($text));
        $chunks = [];
        $current = [];
        $count = 0;

        foreach ($words as $word) {
            $current[] = $word;
            $count += strlen($word) + 1;

            if ($count >= $chunkSize) {
                $chunks[] = implode(' ', $current);
                $current = [];
                $count = 0;
            }
        }

        if (! empty($current)) {
            $chunks[] = implode(' ', $current);
        }

        return $chunks;
    }
}
