<template>
  <div class="min-h-screen bg-[#f5f7f0] flex items-center justify-center">
    <div class="max-w-sm mx-auto px-4 w-full">
      <div class="bg-white rounded-2xl shadow-sm p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-[#2D8A4E] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 class="text-xl font-bold text-[#2D8A4E]">导出报名列表</h1>
          <p class="text-sm text-gray-400 mt-1">输入口令下载全量报名记录</p>
        </div>

        <form @submit.prevent="handleExport">
          <div class="mb-6">
            <label class="block text-sm text-gray-500 mb-1.5">口令</label>
            <input
              v-model="password"
              type="password"
              placeholder="请输入导出口令"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
            />
            <p v-if="error" class="text-red-400 text-xs mt-1">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="exporting"
            :class="[
              'w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all',
              exporting
                ? 'bg-[#2D8A4E]/60 cursor-not-allowed'
                : 'bg-[#2D8A4E] hover:bg-[#237a3f] active:scale-[0.98] shadow-lg shadow-[#2D8A4E]/20'
            ]"
          >
            <span v-if="exporting" class="flex items-center justify-center gap-2">
              <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              导出中...
            </span>
            <span v-else>下载全量列表</span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <button
            @click="goBack"
            class="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const password = ref('')
const error = ref('')
const exporting = ref(false)

async function handleExport() {
  if (!password.value.trim()) {
    error.value = '请输入口令'
    return
  }

  error.value = ''
  exporting.value = true

  try {
    const res = await fetch('/api/export-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value.trim() }),
    })

    if (!res.ok) {
      const data = await res.json()
      error.value = data.message || '口令错误'
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const contentDisposition = res.headers.get('Content-Disposition') || ''
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/)
    a.download = filenameMatch ? filenameMatch[1] : 'tennis-all-registrations.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    error.value = '网络错误，请稍后重试'
  } finally {
    exporting.value = false
  }
}

function goBack() {
  router.push('/admin')
}
</script>