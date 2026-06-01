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
          <div v-for="(label, index) in classDayLabels" :key="index" class="flex justify-between text-sm">
            <span class="text-gray-400">上课日{{ classDayLabels.length > 1 ? index + 1 : '' }}</span>
            <span class="text-gray-700 font-medium">{{ label }}</span>
          </div>
        </div>

        <p class="text-xs text-gray-400 mb-6">请按时上课，如有变动请提前联系网球小组组长</p>

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
const classDaysStr = route.query.classDays as string || ''
const classDays = classDaysStr ? classDaysStr.split(',').filter(Boolean) : []

function getWeekDates() {
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)

  const dayOfWeek = beijingTime.getDay()
  let daysToMonday: number
  if (dayOfWeek === 0) {
    daysToMonday = -6
  } else {
    daysToMonday = 1 - dayOfWeek
  }

  const monday = new Date(beijingTime)
  monday.setDate(monday.getDate() + daysToMonday)

  const tuesday = new Date(monday)
  tuesday.setDate(tuesday.getDate() + 1)

  const wednesday = new Date(monday)
  wednesday.setDate(wednesday.getDate() + 2)

  const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  return {
    tuesday: fmt(tuesday),
    wednesday: fmt(wednesday),
  }
}

const weekDates = getWeekDates()

const dayLabelMap: Record<string, string> = {
  tuesday: '周二',
  wednesday: '周三',
}

const classDayLabels = computed(() => {
  const dayOrder: Record<string, number> = { tuesday: 0, wednesday: 1 }
  return [...classDays]
    .sort((a, b) => (dayOrder[a] || 0) - (dayOrder[b] || 0))
    .map(d => {
      const label = dayLabelMap[d] || d
      const date = d === 'tuesday' ? weekDates.tuesday : d === 'wednesday' ? weekDates.wednesday : ''
      return `${label}（${date}）`
    })
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