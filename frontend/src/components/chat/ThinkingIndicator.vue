<template>
  <div class="thinking-container" role="status" aria-label="Thinking...">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</template>

<style scoped>
.thinking-container {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--primary);
  animation: pulse 1.2s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

.dot:nth-child(3) {
  animation-delay: 0s;
}

@keyframes pulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.85);
  }
  40% {
    opacity: 0.9;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
    opacity: 0.65;
  }
}
</style>
