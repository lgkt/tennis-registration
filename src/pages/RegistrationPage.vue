<template>
  <div class="min-h-screen bg-[#f5f7f0]">
    <div class="max-w-md mx-auto px-4 py-6">
      <div class="relative text-center mb-8">
        <button
          @click="goAdmin"
          class="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-300 hover:text-gray-400 transition-colors"
        >
          管理
        </button>
        <div class="w-16 h-16 bg-[#2D8A4E] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke-width="1.8"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3c-1.5 2-2.5 5-2.5 9s1 7 2.5 9"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3c1.5 2 2.5 5 2.5 9s-1 7-2.5 9"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M3.5 8.5C5.5 9.5 8.5 10.5 12 10.5s6.5-1 8.5-2"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M3.5 15.5c2-1 5-2 8.5-2s6.5 1 8.5 2"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-[#2D8A4E] tracking-wide">网球课报名</h1>
        <p class="text-gray-500 text-sm mt-1">开放时间：每周一 9:00 ~ 周二 17:00（北京时间）</p>
        <p v-if="weekDates" class="text-gray-400 text-xs mt-2">
          本周为 {{ weekDates.year }}年第{{ weekDates.weekNum }}周（{{ weekDates.monday }}-{{ weekDates.sunday }}）
        </p>
        <p class="text-blue-500 text-sm mt-1" style="font-family: 'Microsoft YaHei', '微软雅黑', sans-serif">当前北京时间</p>
        <p class="text-blue-500 text-lg font-semibold tracking-wider -mt-0.5" style="font-family: 'Microsoft YaHei', '微软雅黑', sans-serif">
          {{ beijingTimeStr }}
        </p>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="w-10 h-10 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-gray-400 mt-4">加载中...</p>
      </div>

      <template v-else>
        <div v-if="!isOpen" class="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-700 mb-2">报名暂未开放</h2>
          <p class="text-gray-400 text-sm">开放时间：每周一 9:00 ~ 周二 17:00（北京时间）</p>
          <div v-if="nextOpenTime" class="mt-4 text-sm text-gray-500">
            距离开放还有
            <span class="text-[#2D8A4E] font-semibold">{{ countdown }}</span>
          </div>
        </div>

        <template v-else>
          <div class="grid grid-cols-2 gap-3 mb-6">
            <div
              :class="[
                'relative rounded-2xl p-4 text-center',
                status.tuesday >= maxTuesday
                  ? 'bg-gray-100 opacity-60'
                  : 'bg-white shadow-sm'
              ]"
            >
              <div class="text-xs text-gray-400 mb-1">周二</div>
              <div class="text-xs text-gray-300 mb-2">{{ weekDates.tuesday }}</div>
              <div class="text-3xl font-bold" :class="status.tuesday >= maxTuesday ? 'text-gray-400' : 'text-[#2D8A4E]'">
                {{ status.tuesday }}
              </div>
              <div class="text-xs text-gray-400 mt-1">/ {{ maxTuesday }} 人</div>
              <div v-if="status.tuesday >= maxTuesday" class="absolute -top-2 -right-2 bg-[#F5A623] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                已满
              </div>
              <div
                v-else
                class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-[#2D8A4E] rounded-full transition-all duration-500"
                  :style="{ width: `${(status.tuesday / maxTuesday) * 100}%` }"
                ></div>
              </div>
            </div>

            <div
              :class="[
                'relative rounded-2xl p-4 text-center',
                status.wednesday >= maxWednesday
                  ? 'bg-gray-100 opacity-60'
                  : 'bg-white shadow-sm'
              ]"
            >
              <div class="text-xs text-gray-400 mb-1">周三</div>
              <div class="text-xs text-gray-300 mb-2">{{ weekDates.wednesday }}</div>
              <div class="text-3xl font-bold" :class="status.wednesday >= maxWednesday ? 'text-gray-400' : 'text-[#2D8A4E]'">
                {{ status.wednesday }}
              </div>
              <div class="text-xs text-gray-400 mt-1">/ {{ maxWednesday }} 人</div>
              <div v-if="status.wednesday >= maxWednesday" class="absolute -top-2 -right-2 bg-[#F5A623] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                已满
              </div>
              <div
                v-else
                class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-[#2D8A4E] rounded-full transition-all duration-500"
                  :style="{ width: `${(status.wednesday / maxWednesday) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm p-6">
            <h2 class="text-base font-semibold text-gray-700 mb-4">填写报名信息</h2>

            <form @submit.prevent="handleSubmit">
              <div class="mb-4">
                <label class="block text-sm text-gray-500 mb-1.5">
                  姓名 <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    v-model="form.name"
                    @input="checkMember"
                    type="text"
                    placeholder="请输入姓名"
                    :class="[
                      'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm pr-10',
                      checkingMember ? 'border-gray-300' : ''
                    ]"
                  />
                  <div v-if="checkingMember" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <div class="w-4 h-4 border-2 border-[#2D8A4E] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
                <p v-if="memberStatus" :class="['text-xs mt-1', memberStatus.isValid ? 'text-[#2D8A4E]' : 'text-red-400']">
                  {{ memberStatus.message }}
                </p>
                <p v-if="errors.name" class="text-red-400 text-xs mt-1">{{ errors.name }}</p>
              </div>

              <div class="mb-6">
                <label class="block text-sm text-gray-500 mb-1.5">
                  上课日 <span class="text-red-400">*</span>
                  <span v-if="multiDayEnabled" class="text-xs text-gray-400 font-normal ml-1">（可多选）</span>
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    :disabled="status.tuesday >= maxTuesday"
                    @click="toggleDay('tuesday')"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDays.includes('tuesday')
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.tuesday >= maxTuesday
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#2D8A4E]/30'
                    ]"
                  >
                    <div class="flex items-center justify-center gap-1.5">
                      <span v-if="multiDayEnabled" :class="['w-4 h-4 rounded border-2 flex items-center justify-center text-xs', form.classDays.includes('tuesday') ? 'bg-[#2D8A4E] border-[#2D8A4E] text-white' : 'border-gray-300']">
                        <svg v-if="form.classDays.includes('tuesday')" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                      </span>
                      周二
                    </div>
                    <div class="text-xs mt-0.5 opacity-70">{{ weekDates.tuesday }}</div>
                    <span v-if="status.tuesday >= maxTuesday" class="block text-xs mt-0.5">名额已满</span>
                  </button>
                  <button
                    type="button"
                    :disabled="status.wednesday >= maxWednesday"
                    @click="toggleDay('wednesday')"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDays.includes('wednesday')
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.wednesday >= maxWednesday
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#2D8A4E]/30'
                    ]"
                  >
                    <div class="flex items-center justify-center gap-1.5">
                      <span v-if="multiDayEnabled" :class="['w-4 h-4 rounded border-2 flex items-center justify-center text-xs', form.classDays.includes('wednesday') ? 'bg-[#2D8A4E] border-[#2D8A4E] text-white' : 'border-gray-300']">
                        <svg v-if="form.classDays.includes('wednesday')" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                      </span>
                      周三
                    </div>
                    <div class="text-xs mt-0.5 opacity-70">{{ weekDates.wednesday }}</div>
                    <span v-if="status.wednesday >= maxWednesday" class="block text-xs mt-0.5">名额已满</span>
                  </button>
                </div>
                <p v-if="errors.classDay" class="text-red-400 text-xs mt-1">{{ errors.classDay }}</p>
              </div>

              <button
                type="submit"
                :disabled="submitting || !memberStatus?.isValid"
                :class="[
                  'w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all',
                  submitting || !memberStatus?.isValid
                    ? 'bg-[#2D8A4E]/60 cursor-not-allowed'
                    : 'bg-[#2D8A4E] hover:bg-[#237a3f] active:scale-[0.98] shadow-lg shadow-[#2D8A4E]/20'
                ]"
              >
                <span v-if="submitting" class="flex items-center justify-center gap-2">
                  <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  提交中...
                </span>
                <span v-else>提交报名</span>
              </button>
            </form>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(true)
const isOpen = ref(false)
const nextOpenTime = ref('')
const submitting = ref(false)
const countdown = ref('')
const weekDates = ref<any>(null)
const memberStatus = ref<any>(null)
const checkingMember = ref(false)
const maxTuesday = ref(10)
const maxWednesday = ref(10)
const multiDayEnabled = ref(false)
const beijingTimeStr = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let memberAbortController: AbortController | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

interface StatusData {
  tuesday: number
  wednesday: number
  isOpen: boolean
  nextOpenTime: string | null
}

const status = reactive<StatusData>({
  tuesday: 0,
  wednesday: 0,
  isOpen: false,
  nextOpenTime: null,
})

const form = reactive({
  name: '',
  classDays: [] as string[],
})

const errors = reactive({
  name: '',
  classDay: '',
})

const STORAGE_KEY = 'tennis_last_form'

function loadLastForm() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      form.name = data.name || ''
      form.classDays = data.classDays ? [...data.classDays] : (data.classDay ? [data.classDay] : [])
      if (form.name) checkMember()
    }
  } catch {
  }
}

function saveForm() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: form.name,
      classDays: form.classDays,
    }))
  } catch {
  }
}

function toggleDay(day: string) {
  if (multiDayEnabled.value) {
    const idx = form.classDays.indexOf(day)
    if (idx >= 0) {
      form.classDays.splice(idx, 1)
    } else {
      form.classDays.push(day)
    }
  } else {
    form.classDays = form.classDays.includes(day) ? [] : [day]
  }
}

async function checkMember() {
  if (!form.name.trim()) {
    memberStatus.value = null
    return
  }
  if (memberAbortController) memberAbortController.abort()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    memberAbortController = new AbortController()
    checkingMember.value = true
    try {
      const res = await fetch('/api/check-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim() }),
        signal: memberAbortController.signal,
      })
      if (!res.ok) {
        memberStatus.value = { isValid: false, message: '校验服务异常，请稍后重试' }
        return
      }
      memberStatus.value = await res.json()
    } catch (e: any) {
      if (e.name === 'AbortError') return
      memberStatus.value = { isValid: false, message: '网络错误，请检查网络后重试' }
    } finally {
      checkingMember.value = false
      memberAbortController = null
    }
  }, 300)
}

function validate(): boolean {
  let valid = true
  errors.name = ''
  errors.classDay = ''

  if (!form.name.trim()) {
    errors.name = '请输入姓名'
    valid = false
  }

  if (form.classDays.length === 0) {
    errors.classDay = '请选择上课日'
    valid = false
  }

  if (!memberStatus.value?.isValid) {
    valid = false
  }

  return valid
}

function updateCountdown() {
  if (!nextOpenTime.value) return
  const now = new Date()
  const target = new Date(nextOpenTime.value)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    countdown.value = '即将开放'
    return
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  parts.push(`${String(hours).padStart(2, '0')}时${String(minutes).padStart(2, '0')}分${String(seconds).padStart(2, '0')}秒`)
  countdown.value = parts.join(' ')
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    status.tuesday = data.tuesday
    status.wednesday = data.wednesday
    isOpen.value = data.isOpen
    nextOpenTime.value = data.nextOpenTime || ''
    weekDates.value = data.weekDates
    maxTuesday.value = data.maxTuesday || 10
    maxWednesday.value = data.maxWednesday || 10
    multiDayEnabled.value = data.multiDayEnabled || false

    if (data.nextOpenTime) {
      updateCountdown()
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = setInterval(updateCountdown, 1000)
    }
  } catch {
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!validate()) return

  submitting.value = true
  try {
    const body: any = { name: form.name.trim() }
    if (multiDayEnabled.value) {
      body.classDays = form.classDays
    } else {
      body.classDay = form.classDays[0]
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (data.success) {
      saveForm()
      router.push({
        path: '/success',
        query: {
          name: form.name.trim(),
          classDays: data.classDays ? data.classDays.join(',') : form.classDays[0],
        },
      })
    } else {
      errors.name = data.message || '报名失败，请重试'
    }
  } catch {
    errors.name = '网络错误，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function goAdmin() {
  router.push('/admin')
}

function formatBeijingTime(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const beijing = new Date(now.getTime() + (offset + 480) * 60 * 1000)
  const y = beijing.getFullYear()
  const M = String(beijing.getMonth() + 1).padStart(2, '0')
  const d = String(beijing.getDate()).padStart(2, '0')
  const h = String(beijing.getHours()).padStart(2, '0')
  const m = String(beijing.getMinutes()).padStart(2, '0')
  const s = String(beijing.getSeconds()).padStart(2, '0')
  return `${y}/${M}/${d} ${h}:${m}:${s}`
}

onMounted(() => {
  beijingTimeStr.value = formatBeijingTime()
  clockTimer = setInterval(() => {
    beijingTimeStr.value = formatBeijingTime()
  }, 1000)
  loadLastForm()
  fetchStatus()
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (memberAbortController) memberAbortController.abort()
})
</script>