<script setup lang="ts">
defineProps<{
  intensity?: 'subtle' | 'vibrant'
}>()
</script>

<template>
  <div class="grok-aurora-wrapper" :class="{ 'opacity-50': intensity === 'subtle' }">
    <div class="grok-blob-1"></div>
    <div class="grok-blob-2"></div>
    <div class="grok-blob-3"></div>
  </div>
</template>

