<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FileAttachmentItem } from '../../types'
import { buildUrl } from '../../services/api'

const props = defineProps<{
  images: FileAttachmentItem[]
}>()

const isLightboxOpen = ref(false)
const currentIndex = ref(0)
const failedImages = ref<Record<string, boolean>>({})

const totalImages = computed(() => props.images.length)
const currentImage = computed(() => props.images[currentIndex.value] || props.images[0])

function getImageUrl(file?: FileAttachmentItem): string {
  if (!file) return ''
  if (failedImages.value[file.id]) return ''
  if (file.previewUrl) return file.previewUrl
  if (file.metadata?.dataUrl) return file.metadata.dataUrl
  if (file.id && !file.id.startsWith('temp-')) {
    const token = localStorage.getItem('token')
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    return buildUrl(`/files/${file.id}/content${qs}`)
  }
  return ''
}

const currentImageUrl = computed(() => getImageUrl(currentImage.value))

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(n).replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)])
}

function openLightbox(index: number) {
  currentIndex.value = Math.max(0, Math.min(index, props.images.length - 1))
  isLightboxOpen.value = true
}

function closeLightbox() {
  isLightboxOpen.value = false
}

function nextImage() {
  if (props.images.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % props.images.length
}

function prevImage() {
  if (props.images.length <= 1) return
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
}

function selectImage(index: number) {
  currentIndex.value = index
}

function handleKeydown(e: KeyboardEvent) {
  if (!isLightboxOpen.value) return
  if (e.key === 'Escape') {
    closeLightbox()
  } else if (e.key === 'ArrowRight') {
    // In RTL, ArrowRight moves to next or previous intuitively
    nextImage()
  } else if (e.key === 'ArrowLeft') {
    prevImage()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="sent-image-gallery-root">
    <div v-if="images && images.length > 0" class="sent-image-gallery" data-testid="sent-image-gallery">
    <!-- Single Image Display -->
    <div
      v-if="images.length === 1"
      class="gallery-single group"
      @click="openLightbox(0)"
      title="کلیک برای بزرگ‌نمایی تصویر"
      data-testid="gallery-single-image"
    >
      <img
        v-if="getImageUrl(images[0]) && !failedImages[images[0].id]"
        :src="getImageUrl(images[0])"
        :alt="images[0].originalName"
        class="gallery-single-img"
        @error="failedImages[images[0].id] = true"
      />
      <div v-else class="gallery-fallback">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span class="text-xs mt-1 text-muted-foreground">{{ images[0].originalName }}</span>
      </div>
      <div class="gallery-hover-overlay">
        <div class="zoom-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 2 Images Grid -->
    <div
      v-else-if="images.length === 2"
      class="gallery-grid grid-cols-2"
      data-testid="gallery-grid-2"
    >
      <div
        v-for="(img, idx) in images"
        :key="img.id"
        class="gallery-grid-item group aspect-[4/3]"
        @click="openLightbox(idx)"
        :title="`مشاهده تصویر ${toPersianDigits(idx + 1)}`"
      >
        <img
          v-if="getImageUrl(img) && !failedImages[img.id]"
          :src="getImageUrl(img)"
          :alt="img.originalName"
          class="gallery-grid-img"
          @error="failedImages[img.id] = true"
        />
        <div v-else class="gallery-fallback">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="gallery-hover-overlay">
          <div class="zoom-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 3 Images Grid -->
    <div
      v-else-if="images.length === 3"
      class="gallery-grid grid-cols-3"
      data-testid="gallery-grid-3"
    >
      <div
        v-for="(img, idx) in images"
        :key="img.id"
        class="gallery-grid-item group aspect-square"
        @click="openLightbox(idx)"
        :title="`مشاهده تصویر ${toPersianDigits(idx + 1)}`"
      >
        <img
          v-if="getImageUrl(img) && !failedImages[img.id]"
          :src="getImageUrl(img)"
          :alt="img.originalName"
          class="gallery-grid-img"
          @error="failedImages[img.id] = true"
        />
        <div v-else class="gallery-fallback">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="gallery-hover-overlay">
          <div class="zoom-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 4 or More Images Grid -->
    <div
      v-else
      class="gallery-grid grid-cols-2"
      data-testid="gallery-grid-multi"
    >
      <div
        v-for="(img, idx) in images.slice(0, 4)"
        :key="img.id"
        class="gallery-grid-item group aspect-square"
        @click="openLightbox(idx)"
        :title="`مشاهده تصویر ${toPersianDigits(idx + 1)}`"
      >
        <img
          v-if="getImageUrl(img) && !failedImages[img.id]"
          :src="getImageUrl(img)"
          :alt="img.originalName"
          class="gallery-grid-img"
          @error="failedImages[img.id] = true"
        />
        <div v-else class="gallery-fallback">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>

        <!-- More Images Overlay on 4th image if total > 4 -->
        <div
          v-if="idx === 3 && images.length > 4"
          class="gallery-more-overlay"
          data-testid="gallery-more-count"
        >
          <span class="text-lg font-bold text-white tracking-wide">
            +{{ toPersianDigits(images.length - 3) }}
          </span>
          <span class="text-[11px] text-white/90">تصویر دیگر</span>
        </div>

        <div v-else class="gallery-hover-overlay">
          <div class="zoom-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Interactive Lightbox Modal (Teleported to Body) -->
  <Teleport to="body">
    <Transition name="fade-gallery">
      <div
        v-if="isLightboxOpen"
        class="gallery-lightbox-backdrop"
        @click.self="closeLightbox"
        data-testid="gallery-lightbox"
      >
        <div class="gallery-lightbox-container" @click.stop>
          <!-- Header Bar -->
          <div class="lightbox-header">
            <div class="lightbox-title-area">
              <span class="lightbox-filename" :title="currentImage?.originalName">
                {{ currentImage?.originalName }}
              </span>
              <span class="lightbox-meta">
                {{ formatFileSize(currentImage?.fileSize) }}
              </span>
            </div>

            <!-- Counter Badge -->
            <div class="lightbox-counter" data-testid="gallery-counter">
              <span class="text-primary font-semibold">{{ toPersianDigits(currentIndex + 1) }}</span>
              <span class="opacity-60">از</span>
              <span>{{ toPersianDigits(totalImages) }}</span>
            </div>

            <!-- Actions -->
            <div class="lightbox-actions">
              <a
                v-if="currentImageUrl"
                :href="currentImageUrl"
                :download="currentImage?.originalName || 'image'"
                class="lightbox-btn"
                title="دانلود تصویر جاری"
                data-testid="gallery-download-btn"
                @click.stop
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>
              <button
                type="button"
                class="lightbox-btn close-btn"
                @click="closeLightbox"
                title="بستن (ESC)"
                data-testid="gallery-close-btn"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Main Stage with Navigation Arrows -->
          <div class="lightbox-stage">
            <!-- Previous Button -->
            <button
              v-if="totalImages > 1"
              type="button"
              class="nav-btn prev-btn"
              @click.stop="prevImage"
              title="تصویر قبلی (کلید جهت‌نما)"
              data-testid="gallery-prev-btn"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            <!-- Main Image Wrapper -->
            <div class="main-image-wrapper">
              <Transition name="fade-slide" mode="out-in">
                <img
                  :key="currentImage?.id || currentIndex"
                  :src="currentImageUrl"
                  :alt="currentImage?.originalName"
                  class="main-image"
                />
              </Transition>
            </div>

            <!-- Next Button -->
            <button
              v-if="totalImages > 1"
              type="button"
              class="nav-btn next-btn"
              @click.stop="nextImage"
              title="تصویر بعدی (کلید جهت‌نما)"
              data-testid="gallery-next-btn"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <!-- Bottom Thumbnail Strip (Only if multiple images) -->
          <div v-if="totalImages > 1" class="thumbnail-strip" data-testid="gallery-thumbnails">
            <button
              v-for="(img, idx) in images"
              :key="img.id"
              type="button"
              class="thumb-btn"
              :class="{ active: idx === currentIndex }"
              @click="selectImage(idx)"
              :title="img.originalName"
              :data-testid="`gallery-thumb-${idx}`"
            >
              <img
                :src="getImageUrl(img)"
                :alt="img.originalName"
                class="thumb-img"
              />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  </div>
</template>

<style scoped>
.sent-image-gallery {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
}

/* Single Image */
.gallery-single {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  max-width: 320px;
  max-height: 240px;
  background-color: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  cursor: pointer;
}

.gallery-single-img {
  width: 100%;
  height: 100%;
  max-height: 240px;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.gallery-single:hover .gallery-single-img {
  transform: scale(1.02);
}

/* Grid Layouts */
.gallery-grid {
  display: grid;
  gap: 6px;
  max-width: 340px;
  border-radius: 12px;
  overflow: hidden;
}

.gallery-grid-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  cursor: pointer;
}

.gallery-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.gallery-grid-item:hover .gallery-grid-img {
  transform: scale(1.04);
}

.gallery-fallback {
  width: 100%;
  height: 100%;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground, #94a3b8);
  background: rgba(255, 255, 255, 0.03);
}

.gallery-hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.group:hover .gallery-hover-overlay {
  opacity: 1;
}

.zoom-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: scale(0.9);
  transition: transform 0.18s ease;
}

.group:hover .zoom-badge {
  transform: scale(1);
}

.gallery-more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.gallery-more-overlay:hover {
  background: rgba(0, 0, 0, 0.75);
}

/* =======================================================
   LIGHTBOX MODAL
   ======================================================= */
.gallery-lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: rgba(0, 0, 0, 0.86);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  user-select: none;
}

.gallery-lightbox-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1040px;
  height: 94vh;
  gap: 12px;
}

.lightbox-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 16px;
  background-color: rgba(23, 23, 23, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  direction: rtl;
  color: #f8fafc;
}

.lightbox-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  max-width: calc(50% - 65px);
  min-width: 0;
}

.lightbox-filename {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lightbox-meta {
  font-size: 11px;
  color: #94a3b8;
  direction: ltr;
  flex-shrink: 0;
}

.lightbox-counter {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 3px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  pointer-events: none;
  z-index: 10;
}

.lightbox-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lightbox-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.lightbox-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  transform: scale(1.05);
}

.lightbox-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.5);
}

/* Stage Area */
.lightbox-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex: 1;
  min-height: 0;
  gap: 16px;
}

.main-image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(23, 23, 23, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
  z-index: 10;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.nav-btn:active {
  transform: scale(0.95);
}

/* Thumbnail Strip */
.thumbnail-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(23, 23, 23, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  max-width: 90%;
  overflow-x: auto;
}

.thumb-btn {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  opacity: 0.55;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.thumb-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.thumb-btn.active {
  opacity: 1;
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 0 12px var(--primary, rgba(59, 130, 246, 0.5));
  transform: scale(1.05);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Transitions */
.fade-gallery-enter-active,
.fade-gallery-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-gallery-enter-from,
.fade-gallery-leave-to {
  opacity: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: scale(1.03);
}
</style>
