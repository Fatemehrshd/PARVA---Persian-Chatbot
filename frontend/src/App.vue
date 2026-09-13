<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div id="layout">
    <header>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <span class="divider">|</span>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
    'Open Sans', 'Helvetica Neue', sans-serif;
  color: #1e293b;
  background-color: #ffffff;
}

header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: center;
}

nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.1rem;
}

nav a {
  text-decoration: none;
  color: #3b82f6;
  font-weight: 500;
}

nav a.router-link-exact-active {
  color: #1d4ed8;
  font-weight: 700;
}

.divider {
  color: #94a3b8;
}
</style>
