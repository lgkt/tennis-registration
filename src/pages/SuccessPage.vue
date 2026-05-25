<template>
  <div class="min-h-screen bg-[#f5f7f0] flex items-center justify-center">
    <div class="max-w-md mx-auto px-4 w-full">
      <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div class="w-20 h-20 bg-[#2D8A4E] rounded-full flex items-center justify-center mx-auto mb-5 animate-bounce-in">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 class="text-2xl font-bold text-[#2D8A4E] mb-2">报名成功！</h1>
        <p class="text-gray-500 text-sm mb-6">恭喜您已成功报名网球课</p>

        <div class="bg-[#f5f7f0] rounded-xl p-4 mb-6 text-left space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-400">姓名</span>
            <span class="text-gray-700 font-medium">{{ name }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-400">上课日</span>
            <span class="text-gray-700 font-medium">{{ classDayLabel }}</span>
          </div>
        </div>

        <p class="text-xs text-gray-400 mb-6">请按时上课，如有变动请提前联系教练</p>

        <button
          @click="goHome"
          class="w-full py-3 rounded-xl bg-[#2D8A4E] text-white font-semibold text-base hover:bg-[#237a3f] active:scale-[0.98] transition-all shadow-lg shadow-[#2D8A4E]/20"
        >
          返回首页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const name = route.query.name as string || ''
const classDay = route.query.classDay as string || ''

const classDayLabel = computed(() => {
  return classDay === 'tuesday' ? '周二' : classDay === 'wednesday' ? '周三' : ''
})

function goHome() {
  router.push('/')
}
</script>

<style scoped>
@keyframes bounceIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-in {
  animation: bounceIn 0.5s ease-out;
}
</style>