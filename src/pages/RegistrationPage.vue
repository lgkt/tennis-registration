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
        <p v-if="isOpen && forceOpen && forceOpenReason" class="text-green-600 text-xs mt-1">{{ forceOpenReason }}</p>
        <p v-if="weekDates" class="text-gray-400 text-xs mt-2">
          本周为 {{ weekDates.year }}年第{{ weekDates.weekNum }}周（{{ weekDates.monday }}-{{ weekDates.sunday }}）
        </p>
        <p class="text-blue-500 text-sm mt-1" style="font-family: 'Microsoft YaHei', '微软雅黑', sans-serif">当前北京时间</p>
        <p class="text-blue-500 text-lg font-semibold tracking-wider -mt-0.5" style="font-family: 'Microsoft YaHei', '微软雅黑', sans-serif">
          {{ beijingTimeStr }}
        </p>
      </div>

      <div v-if="notificationText" class="bg-[#FFF8E1] border border-[#FFE082] rounded-xl px-4 py-3 mb-5 text-sm text-[#8D6E00] leading-relaxed whitespace-pre-line">
        {{ notificationText }}
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
            <h2 class="text-lg font-semibold text-gray-700 mb-2">{{ forceClose && forceCloseReason ? '报名暂停' : '报名暂未开放' }}</h2>
            <p v-if="forceClose && forceCloseReason" class="text-gray-500 text-sm">{{ forceCloseReason }}</p>
            <p v-else class="text-gray-400 text-sm">开放时间：每周一 9:00 ~ 周二 17:00（北京时间）</p>
            <div v-if="!forceClose && nextOpenTime" class="mt-4 text-sm text-gray-500">
              距离开放还有
              <span class="text-[#2D8A4E] font-semibold">{{ countdown }}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-6">
            <div
              :class="[
                'relative rounded-2xl p-4 text-center',
                cancellations['tuesday']
                  ? 'bg-red-50 opacity-80'
                  : status.tuesday >= maxTuesday
                    ? 'bg-gray-100 opacity-60'
                    : 'bg-white shadow-sm'
              ]"
            >
              <div v-if="cancellations['tuesday']" class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center bg-red-50/90 z-10">
                <div class="text-red-500 font-bold text-sm">周二 {{ weekDates.tuesday }}</div>
                <div class="text-red-500 font-bold text-sm mb-1">课程取消</div>
                <div class="text-red-400 text-xs px-2 text-center">{{ cancellations['tuesday'] }}</div>
              </div>
              <div :class="cancellations['tuesday'] ? 'opacity-20' : ''">
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
            </div>

            <div
              :class="[
                'relative rounded-2xl p-4 text-center',
                cancellations['wednesday']
                  ? 'bg-red-50 opacity-80'
                  : status.wednesday >= maxWednesday
                    ? 'bg-gray-100 opacity-60'
                    : 'bg-white shadow-sm'
              ]"
            >
              <div v-if="cancellations['wednesday']" class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center bg-red-50/90 z-10">
                <div class="text-red-500 font-bold text-sm">周三 {{ weekDates.wednesday }}</div>
                <div class="text-red-500 font-bold text-sm mb-1">课程取消</div>
                <div class="text-red-400 text-xs px-2 text-center">{{ cancellations['wednesday'] }}</div>
              </div>
              <div :class="cancellations['wednesday'] ? 'opacity-20' : ''">
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
          </div>

          <div v-if="isOpen && closeTime" class="text-center mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-600">
            距离报名结束还有
            <span class="font-semibold">{{ closeCountdown }}</span>
          </div>

        <div class="bg-white rounded-2xl shadow-sm p-6">
            <h2 v-if="isOpen" class="text-base font-semibold text-gray-700 mb-4">填写报名信息</h2>

            <form @submit.prevent="handleSubmit">
              <div class="mb-4">
                <label class="block text-sm text-gray-500 mb-1.5">
                  姓名 <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    v-model="form.name"
                    @input="onNameInput"
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

              <template v-if="isOpen">
              <div class="mb-6">
                <label class="block text-sm text-gray-500 mb-1.5">
                  上课日 <span class="text-red-400">*</span>
                  <span v-if="multiDayEnabled" class="text-xs text-gray-400 font-normal ml-1">（可多选）</span>
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    :disabled="status.tuesday >= maxTuesday || !!cancellations['tuesday']"
                    @click="toggleDay('tuesday')"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDays.includes('tuesday')
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.tuesday >= maxTuesday || cancellations['tuesday']
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
                    <span v-if="cancellations['tuesday']" class="block text-xs mt-0.5 text-red-400">课程已取消</span>
                    <span v-else-if="status.tuesday >= maxTuesday" class="block text-xs mt-0.5">名额已满</span>
                  </button>
                  <button
                    type="button"
                    :disabled="status.wednesday >= maxWednesday || !!cancellations['wednesday']"
                    @click="toggleDay('wednesday')"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDays.includes('wednesday')
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.wednesday >= maxWednesday || cancellations['wednesday']
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
                    <span v-if="cancellations['wednesday']" class="block text-xs mt-0.5 text-red-400">课程已取消</span>
                    <span v-else-if="status.wednesday >= maxWednesday" class="block text-xs mt-0.5">名额已满</span>
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
            </template>
            </form>
          </div>

          <div :class="['bg-white rounded-2xl shadow-sm p-6 mt-4 transition-opacity', !memberStatus?.isValid ? 'opacity-40' : '']">
            <h2 class="text-base font-semibold text-gray-700 mb-4">签到</h2>

            <div v-if="memberStatus?.isValid && checkinResults.length > 0" class="space-y-2 mb-3">
              <div
                v-for="result in checkinResults"
                :key="result.classDay"
                class="rounded-xl px-4 py-2.5 text-xs"
                :class="{
                  'bg-blue-50 border border-blue-200 text-blue-600': result.status === 'applied',
                  'bg-green-50 border border-green-200 text-green-600': result.status === 'approved' || result.status === 'walkin',
                  'bg-red-50 border border-red-200 text-red-500': result.status === 'rejected',
                }"
              >
                <template v-if="result.status === 'applied'">
                  ⏳ {{ result.classDay === 'tuesday' ? '周二' : '周三' }}签到申请已提交，等待审批
                </template>
                <template v-else-if="result.status === 'approved'">
                  ✓ 您{{ result.classDay === 'tuesday' ? '周二' : '周三' }}于北京时间 {{ result.checkInTime }} 签到成功
                </template>
                <template v-else-if="result.status === 'rejected'">
                  ✗ 您{{ result.classDay === 'tuesday' ? '周二' : '周三' }}于北京时间 {{ result.checkInTime }} 签到失败，原因为{{ result.rejectReason }}
                </template>
                <template v-else-if="result.status === 'walkin'">
                  ✓ 您{{ result.classDay === 'tuesday' ? '周二' : '周三' }}于北京时间 {{ result.checkInTime }} 签到成功（临时）
                </template>
              </div>
            </div>

            <div v-if="memberStatus?.isValid && canApplyCheckin">
              <button
                @click="openCheckinModal"
                class="text-sm text-[#2D8A4E] hover:text-[#237a3f] font-medium flex items-center gap-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                申请签到
              </button>
            </div>
            <div v-else-if="!memberStatus?.isValid" class="text-xs text-gray-400">
              请先在上方输入姓名
            </div>
            <p v-if="memberStatus?.isValid && checkinResults.length > 0 && !canApplyCheckin" class="text-xs text-gray-400">
              您本周已申请所有上课日的签到
            </p>
          </div>

      </template>
    </div>

    <div v-if="showCheckinModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">申请签到</h3>
        <p class="text-sm text-gray-500 mb-4">请选择需要签到的上课日</p>
        <div class="mb-4">
          <select
            v-model="checkinClassDay"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
          >
            <option value="tuesday">周二（{{ weekDates?.tuesday || '' }}）</option>
            <option value="wednesday">周三（{{ weekDates?.wednesday || '' }}）</option>
          </select>
        </div>
        <div class="flex gap-3">
          <button
            @click="doApplyCheckin"
            :disabled="applyingCheckin"
            class="flex-1 py-2.5 rounded-xl bg-[#2D8A4E] text-white font-medium text-sm hover:bg-[#237a3f] transition-all disabled:opacity-50"
          >
            {{ applyingCheckin ? '提交中…' : '提交申请' }}
          </button>
          <button @click="showCheckinModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(true)
const isOpen = ref(false)
const nextOpenTime = ref('')
const submitting = ref(false)
const countdown = ref('')
const closeTime = ref('')
const closeCountdown = ref('')
const weekDates = ref<any>(null)
const memberStatus = ref<any>(null)
const checkingMember = ref(false)
const maxTuesday = ref(10)
const maxWednesday = ref(10)
const multiDayEnabled = ref(false)
const beijingTimeStr = ref('')
const pageReady = ref(false)
const notificationText = ref('')
const forceOpen = ref(false)
const forceClose = ref(false)
const forceCloseReason = ref('')
const forceOpenReason = ref('')
const cancellations = reactive<Record<string, string>>({})
const checkinResults = ref<any[]>([])
const showCheckinModal = ref(false)

function getBeijingDay(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const beijing = new Date(now.getTime() + (offset + 480) * 60 * 1000)
  const day = beijing.getDay()
  if (day === 2) return 'tuesday'
  if (day === 3) return 'wednesday'
  return day < 2 ? 'tuesday' : 'wednesday'
}

const checkinClassDay = ref(getBeijingDay())
const applyingCheckin = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null
let closeCountdownTimer: ReturnType<typeof setInterval> | null = null
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

const canApplyCheckin = computed(() => {
  const existingDays = checkinResults.value.map(r => r.classDay)
  return !existingDays.includes('tuesday') || !existingDays.includes('wednesday')
})

const STORAGE_KEY = 'tennis_last_form'

function loadLastForm() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      form.name = data.name || ''
      form.classDays = data.classDays ? [...data.classDays] : (data.classDay ? [data.classDay] : [])
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

function onNameInput() {
  checkMember()
}

async function checkMember(force = false) {
  if (!form.name.trim()) {
    memberStatus.value = null
    return
  }
  // 页面未就绪时，如果不是强制调用，则延迟到就绪后执行
  if (!pageReady.value && !force) {
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
        // 服务初始化中，不显示错误，静默跳过
        if (res.status === 500 || res.status === 503) {
          memberStatus.value = null
          return
        }
        memberStatus.value = { isValid: false, message: '校验服务异常，请稍后重试' }
        return
      }
      memberStatus.value = await res.json()
      if (memberStatus.value?.isValid) {
        fetchCheckinResults()
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return
      memberStatus.value = { isValid: false, message: '网络错误，请检查网络后重试' }
    } finally {
      checkingMember.value = false
      memberAbortController = null
    }
  }, 300)
}

async function fetchCheckinResults() {
  const name = form.name.trim()
  if (!name) {
    checkinResults.value = []
    return
  }
  try {
    const res = await fetch('/api/checkin-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return
    const data = await res.json()
    checkinResults.value = data.results || []
  } catch {
    checkinResults.value = []
  }
}

function openCheckinModal() {
  checkinClassDay.value = getBeijingDay()
  showCheckinModal.value = true
}

async function doApplyCheckin() {
  const name = form.name.trim()
  if (!name) return
  applyingCheckin.value = true
  try {
    const res = await fetch('/api/apply-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, classDay: checkinClassDay.value }),
    })
    const data = await res.json()
    if (data.success) {
      showCheckinModal.value = false
      fetchCheckinResults()
    } else {
      errors.name = data.message || '申请失败'
    }
  } catch {
    errors.name = '网络错误，请稍后重试'
  } finally {
    applyingCheckin.value = false
  }
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

function updateCloseCountdown() {
  if (!closeTime.value) return
  const now = new Date()
  const target = new Date(closeTime.value)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    closeCountdown.value = '即将关闭'
    setTimeout(fetchStatus, 1000)
    return
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  parts.push(`${String(hours).padStart(2, '0')}时${String(minutes).padStart(2, '0')}分${String(seconds).padStart(2, '0')}秒`)
  closeCountdown.value = parts.join(' ')
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status')
    if (!res.ok) {
      return
    }
    const data = await res.json()
    status.tuesday = data.tuesday
    status.wednesday = data.wednesday
    isOpen.value = data.isOpen
    nextOpenTime.value = data.nextOpenTime || ''
    weekDates.value = data.weekDates
    maxTuesday.value = data.maxTuesday || 10
    maxWednesday.value = data.maxWednesday || 10
    multiDayEnabled.value = data.multiDayEnabled || false
    notificationText.value = data.notificationText || ''
    forceCloseReason.value = data.forceCloseReason || ''
    forceOpenReason.value = data.forceOpenReason || ''
    forceOpen.value = data.forceOpen || false
    forceClose.value = data.forceClose || false
    closeTime.value = data.closeTime || ''
    if (data.cancellations) {
      Object.keys(data.cancellations).forEach(k => {
        cancellations[k] = data.cancellations[k]
      })
    }

    if (data.nextOpenTime) {
      updateCountdown()
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = setInterval(updateCountdown, 1000)
    }
    if (data.isOpen && data.closeTime) {
      updateCloseCountdown()
      if (closeCountdownTimer) clearInterval(closeCountdownTimer)
      closeCountdownTimer = setInterval(updateCloseCountdown, 1000)
    }

    // 标记页面就绪，然后强制校验成员
    pageReady.value = true
    if (form.name.trim()) {
      checkMember(true)
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
  if (closeCountdownTimer) clearInterval(closeCountdownTimer)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (memberAbortController) memberAbortController.abort()
})
</script>