<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isPostgres = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($isPostgres) {
            Schema::ensureVectorExtensionExists();
        }

        Schema::create('documents', function (Blueprint $table) use ($isPostgres) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('content');
            $table->unsignedInteger('chunk_index')->default(0);
            $table->string('original_filename')->nullable();

            if ($isPostgres) {
                $table->vector('embedding', dimensions: 1536)->nullable()->index();
            } else {
                $table->json('embedding')->nullable();
            }

            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
