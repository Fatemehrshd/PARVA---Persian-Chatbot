<template>
  <div class="thinking-container" aria-label="Thinking...">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</template>

<style scoped>
.thinking-container {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary);
  animation: pulse 1.4s infinite ease-in-out both;
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
</style>
