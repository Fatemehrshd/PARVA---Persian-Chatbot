<script setup lang="ts">
const props = withDefaults(defineProps<{
  showText?: boolean
  text?: string
}>(), {
  showText: true,
  text: 'درحال تفکر',
})
</script>

<template>
  <div class="thinking-container" role="status" :aria-label="props.showText ? props.text : '...'">
    <span v-if="props.showText" class="thinking-label">{{ props.text }}</span>
    <span class="thinking-dots" aria-hidden="true">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </span>
  </div>
</template>

<style scoped>
.thinking-container {
  display: inline-flex;
  flex-direction: row;
  min-height: 28px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  padding: 6px 10px;
  color: var(--muted-foreground, currentColor);
  font-size: 13px;
  line-height: 1.4;
  direction: rtl;
}

.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
  animation: dotPulse 1.2s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.15s;
}

.dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dotPulse {
  0%, 80%, 100% {
    opacity: 0.2;
    transform: translateY(1px) scale(0.8);
  }
  40% {
    opacity: 1;
    transform: translateY(-1px) scale(1);
  }
}

.thinking-label {
  white-space: nowrap;
  order: 1;
  text-align: right;
}

.thinking-dots {
  order: 2;
}
</style>
