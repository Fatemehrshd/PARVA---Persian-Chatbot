<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
const appTitle = import.meta.env.VITE_APP_TITLE
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
</script>

<template>
  <main class="home-view">
    <h1>Welcome to Vue 3 + Vite</h1>
    <p>This is the Home view configured with TypeScript, Vue Router, and Pinia.</p>

    <div class="counter-card">
      <h2>Pinia Store Example</h2>
      <p>Current count: <strong>{{ counter.count }}</strong></p>
      <p>Double count: <strong>{{ counter.doubleCount }}</strong></p>
      <div class="buttons">
        <button @click="counter.decrement">- Decrement</button>
        <button @click="counter.increment">+ Increment</button>
      </div>
    </div>

    <div class="env-card">
      <h2>Environment Configuration (.env)</h2>
      <p>App Title: <code>{{ appTitle }}</code></p>
      <p>Backend API URL: <code>{{ apiBaseUrl }}</code></p>
    </div>
  </main>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
}

.counter-card,
.env-card {
  padding: 1.5rem 2rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

code {
  background-color: #e2e8f0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #f1f5f9;
}
</style>
