<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground" dir="rtl">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
      <RouterView />
    </div>
  </div>
</template>

<style>
@import './assets/main.css';
</style>
