<template>
  <div class="min-h-screen bg-[#f5f7f0]">
    <div v-if="!authenticated" class="min-h-screen flex items-center justify-center">
      <div class="max-w-sm mx-auto px-4 w-full">
        <div class="bg-white rounded-2xl shadow-sm p-8">
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-[#2D8A4E] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 class="text-xl font-bold text-[#2D8A4E]">管理后台</h1>
            <p class="text-sm text-gray-400 mt-1">请输入管理口令</p>
          </div>

          <button @click="goHome" class="text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            返回报名页
          </button>

          <form @submit.prevent="handleLogin">
            <div class="mb-6">
              <input
                v-model="adminPassword"
                type="password"
                placeholder="请输入口令"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
              />
              <p v-if="loginError" class="text-red-400 text-xs mt-1">{{ loginError }}</p>
            </div>
            <button
              type="submit"
              :disabled="authenticating"
              :class="[
                'w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all',
                authenticating
                  ? 'bg-[#2D8A4E]/60 cursor-not-allowed'
                  : 'bg-[#2D8A4E] hover:bg-[#237a3f] active:scale-[0.98] shadow-lg shadow-[#2D8A4E]/20'
              ]"
            >
              <span v-if="authenticating" class="flex items-center justify-center gap-2">
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                验证中...
              </span>
              <span v-else>进入后台</span>
            </button>
          </form>
        </div>
      </div>
    </div>

    <template v-else>
      <div v-if="notification" class="fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm max-w-sm transition-all" :class="notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'">
        {{ notification.message }}
      </div>
      <div class="max-w-6xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-bold text-[#2D8A4E]">管理后台</h1>
            <div class="flex gap-2 mt-2">
              <button @click="activeTab = 'registrations'" :class="['px-3 py-1 rounded text-sm', activeTab === 'registrations' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 border border-gray-200']">报名管理</button>
              <button @click="activeTab = 'members'" :class="['px-3 py-1 rounded text-sm', activeTab === 'members' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 border border-gray-200']">成员管理</button>
              <button @click="activeTab = 'statistics'" :class="['px-3 py-1 rounded text-sm', activeTab === 'statistics' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 border border-gray-200']">统计</button>
              <button @click="activeTab = 'checkin-review'" :class="['px-3 py-1 rounded text-sm relative', activeTab === 'checkin-review' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 border border-gray-200']">
                签到审批
                <span v-if="pendingCheckinCount > 0" class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{{ pendingCheckinCount > 9 ? '9+' : pendingCheckinCount }}</span>
              </button>
            </div>
          </div>
          <button @click="goHome" class="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">返回首页</button>
        </div>

        <template v-if="activeTab === 'registrations'">
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <select v-model="selectedWeek" @change="fetchRegistrations" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option v-for="w in availableWeeks" :key="w" :value="w">{{ w }}</option>
            </select>
            <select v-model="registrationSourceFilter" @change="fetchRegistrations" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option value="">全部来源</option>
              <option value="CNCC">CNCC</option>
              <option value="CFID">CFID</option>
              <option value="SQQ">SQQ</option>
            </select>
            <button @click="showImportModal = true" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">导入报名</button>
            <button @click="exportThisWeek" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">导出本周</button>
            <button @click="exportAll" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">导出全部</button>
            <div class="ml-auto flex items-center gap-2">
              <button @click="openCancelClass" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">取消课程</button>
              <button @click="showWalkInModal = true" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">临时签到</button>
              <span class="text-xs text-gray-400">临时开放</span>
              <button
                @click="toggleForceOpen"
                :disabled="updatingSetting"
                :class="[
                  'relative w-11 h-6 rounded-full transition-all',
                  forceOpen ? 'bg-[#2D8A4E]' : 'bg-gray-300'
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all',
                    forceOpen ? 'translate-x-5' : 'translate-x-0'
                  ]"
                ></span>
              </button>
              <input
                v-if="forceOpen"
                v-model="forceOpenReason"
                type="text"
                placeholder="开放原因"
                class="w-28 px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 outline-none focus:border-[#2D8A4E]"
                @blur="saveForceOpenReason"
                @keyup.enter="saveForceOpenReason"
              />
              <span class="text-xs text-gray-400 ml-2">临时关闭</span>
              <button
                @click="toggleForceClose"
                :disabled="updatingSetting"
                :class="[
                  'relative w-11 h-6 rounded-full transition-all',
                  forceClose ? 'bg-red-500' : 'bg-gray-300'
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all',
                    forceClose ? 'translate-x-5' : 'translate-x-0'
                  ]"
                ></span>
              </button>
              <input
                v-if="forceClose"
                v-model="forceCloseReason"
                type="text"
                placeholder="关闭原因"
                class="w-28 px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 outline-none focus:border-[#2D8A4E]"
                @blur="saveForceCloseReason"
                @keyup.enter="saveForceCloseReason"
              />
            </div>
          </div>

          <div v-if="loadingRegistrations" class="text-center py-12">
            <div class="w-8 h-8 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>

          <template v-else>
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="bg-white rounded-xl px-5 py-3 shadow-sm">
                <div class="text-xs text-gray-400">周二报名</div>
                <div class="text-xl font-bold text-[#2D8A4E]">{{ tuesdayCount }}<span class="text-sm text-gray-400 font-normal"> / {{ settings.maxTuesday }}</span></div>
              </div>
              <div class="bg-white rounded-xl px-5 py-3 shadow-sm">
                <div class="text-xs text-gray-400">周三报名</div>
                <div class="text-xl font-bold text-[#2D8A4E]">{{ wednesdayCount }}<span class="text-sm text-gray-400 font-normal"> / {{ settings.maxWednesday }}</span></div>
              </div>
              <div class="bg-white rounded-xl px-5 py-3 shadow-sm">
                <div class="text-xs text-gray-400">总报名</div>
                <div class="text-xl font-bold text-[#2D8A4E]">{{ totalCount }}<span class="text-sm text-gray-400 font-normal"> / {{ settings.maxTuesday + settings.maxWednesday }}</span></div>
              </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
              <button @click="showSettings = !showSettings" class="flex items-center justify-between w-full text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <span class="font-medium">容量设置</span>
                <svg :class="['w-4 h-4 transition-transform', showSettings ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="showSettings" class="mt-4 space-y-4">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex-1">
                    <label class="text-xs text-gray-400 block mb-1">周二上限（人）</label>
                    <input
                      v-model.number="settings.maxTuesday"
                      type="number"
                      min="1"
                      max="100"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="text-xs text-gray-400 block mb-1">周三上限（人）</label>
                    <input
                      v-model.number="settings.maxWednesday"
                      type="number"
                      min="1"
                      max="100"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
                    />
                  </div>
                  <div class="flex items-end pb-1">
                    <button
                      @click="saveCapacitySettings"
                      :disabled="savingCapacity"
                      class="px-4 py-2 rounded-lg bg-[#2D8A4E] text-white text-sm hover:bg-[#237a3f] transition-all disabled:opacity-50"
                    >
                      {{ savingCapacity ? '保存中…' : '保存' }}
                    </button>
                  </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span class="text-sm text-gray-500">允许多选上课日</span>
                  <button
                    @click="toggleMultiDay"
                    :disabled="savingCapacity"
                    :class="[
                      'relative w-11 h-6 rounded-full transition-all',
                      settings.multiDayEnabled ? 'bg-[#2D8A4E]' : 'bg-gray-300'
                    ]"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all',
                        settings.multiDayEnabled ? 'translate-x-5' : 'translate-x-0'
                      ]"
                    ></span>
                  </button>
                </div>
                <div class="pt-3 border-t border-red-100 space-y-2">
                  <div class="flex gap-2">
                    <button
                      @click="clearRegistrations('week')"
                      :disabled="clearingRegistrations"
                      class="flex-1 py-2.5 rounded-lg bg-red-50 text-red-500 border border-red-200 text-sm font-medium hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {{ clearingRegistrations ? '清空中…' : '清空本周报名' }}
                    </button>
                    <button
                      @click="clearRegistrations('all')"
                      :disabled="clearingRegistrations"
                      class="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      {{ clearingRegistrations ? '清空中…' : '清空本年报名' }}
                    </button>
                  </div>
                  <p class="text-xs text-red-300">清空操作不可恢复，请谨慎使用</p>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
              <button @click="showNotifSettings = !showNotifSettings" class="flex items-center justify-between w-full text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <span class="font-medium">通知设置</span>
                <svg :class="['w-4 h-4 transition-transform', showNotifSettings ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="showNotifSettings" class="mt-4 space-y-3">
                <textarea
                  v-model="notificationText"
                  rows="3"
                  placeholder="输入通知内容，留空则不显示"
                  class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white resize-none"
                ></textarea>
                <button
                  @click="saveNotificationText"
                  :disabled="savingNotif || notificationIsSaved"
                  class="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:cursor-not-allowed"
                  :class="savingNotif || notificationIsSaved ? 'bg-gray-200 text-gray-400' : 'bg-[#2D8A4E] text-white hover:bg-[#237a3f]'"
                >
                  {{ savingNotif ? '保存中…' : '保存通知' }}
                </button>
              </div>
            </div>

            <div v-if="registrations.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p class="text-gray-400 text-sm">本周暂无报名记录</p>
            </div>

            <div v-else class="bg-white rounded-2xl shadow-sm overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">序号</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">姓名</th>
                    <th @click="toggleRegSort('source')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="registrationSortBy === 'source' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      来自{{ registrationSortBy === 'source' ? '↓' : '' }}
                    </th>
                    <th @click="toggleRegSort('class_day')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="registrationSortBy === 'class_day' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      上课日{{ registrationSortBy === 'class_day' ? '↓' : '' }}
                    </th>
                    <th @click="toggleRegSort('class_date')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="registrationSortBy === 'class_date' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      上课日期{{ registrationSortBy === 'class_date' ? '↓' : '' }}
                    </th>
                    <th @click="toggleRegSort('created_at')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="registrationSortBy === 'created_at' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      报名时间{{ registrationSortBy === 'created_at' ? '↓' : '' }}
                    </th>
                    <th @click="toggleRegSort('checkin')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="registrationSortBy === 'checkin' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      签到{{ registrationSortBy === 'checkin' ? '↓' : '' }}
                    </th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">调课</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, index) in registrations" :key="r.id" class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td class="px-5 py-3.5 text-sm text-gray-400">{{ index + 1 }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-700">{{ r.name }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-500">{{ r.source }}</td>
                    <td class="px-5 py-3.5">
                      <span :class="[
                        'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                        r.classDay === 'tuesday' ? 'bg-[#2D8A4E]/10 text-[#2D8A4E]' : 'bg-[#F5A623]/10 text-[#F5A623]'
                      ]">
                        {{ r.classDay === 'tuesday' ? '周二' : '周三' }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-sm text-gray-500">{{ r.classDate }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-400">{{ r.createdAt }}</td>
                    <td class="px-5 py-3.5 text-sm whitespace-nowrap">
                      <template v-if="!r.checkInType">
                        <button @click="doCheckIn(r.id)" :disabled="checkingIn" class="text-green-600 hover:text-green-700 text-xs">签到</button>
                      </template>
                      <template v-else-if="r.checkInType === 'scheduled'">
                        <span class="text-green-600 text-xs">已签到<br>{{ r.checkInTime }}</span>
                      </template>
                      <template v-else-if="r.checkInType === 'walkin'">
                        <span class="text-[#F5A623] text-xs">已临时签到<br>{{ r.checkInTime }}</span>
                      </template>
                      <template v-else-if="r.checkInType === 'applied'">
                        <span class="text-blue-500 text-xs">待审批<br>{{ r.checkInTime }}</span>
                      </template>
                      <template v-else-if="r.checkInType === 'approved'">
                        <span class="text-green-600 text-xs">审批通过<br>{{ r.checkInTime }}</span>
                      </template>
                      <template v-else-if="r.checkInType === 'rejected'">
                        <span class="text-red-500 text-xs">审批驳回<br>{{ r.checkInTime }}</span>
                        <span v-if="r.rejectReason" class="text-red-400 text-xs block">原因：{{ r.rejectReason }}</span>
                      </template>
                    </td>
                    <td class="px-5 py-3.5 text-sm whitespace-nowrap">
                      <button @click="showReschedule(r)" class="text-[#2D8A4E] hover:text-[#237a3f]">调课</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <template v-if="activeTab === 'members'">
          <div class="flex items-center gap-2 mb-4">
            <button @click="isEditingMember = false; editingMemberId = null; memberForm = { name: '', source: 'CNCC' }; showMemberModal = true" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">新增</button>
            <select v-model="memberSourceFilter" @change="fetchMembers" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option value="">全部来源</option>
              <option value="CNCC">CNCC</option>
              <option value="CFID">CFID</option>
              <option value="SQQ">SQQ</option>
            </select>
            <button @click="downloadTemplate" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">下载模板</button>
            <label class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all cursor-pointer">
              导入成员
              <input type="file" @change="importMembers" accept=".csv" class="hidden" />
            </label>
            <button @click="exportMembers" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">导出成员</button>
          </div>

          <div v-if="loadingMembers" class="text-center py-12">
            <div class="w-8 h-8 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>

          <template v-else>
            <div class="bg-white rounded-xl px-5 py-3 shadow-sm mb-4">
              <div class="text-xs text-gray-400">成员总数</div>
              <div class="text-xl font-bold text-[#2D8A4E]">{{ members.length }} 人</div>
            </div>

            <div v-if="members.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p class="text-gray-400 text-sm">暂无成员记录，请先导入</p>
            </div>

            <div v-else class="bg-white rounded-2xl shadow-sm overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">序号</th>
                    <th @click="toggleMemberSort('name')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="memberSortBy === 'name' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      姓名{{ memberSortBy === 'name' ? '↓' : '' }}
                    </th>
                    <th @click="toggleMemberSort('source')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="memberSortBy === 'source' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      来自{{ memberSortBy === 'source' ? '↓' : '' }}
                    </th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, index) in members" :key="m.id" class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td class="px-5 py-3.5 text-sm text-gray-400">{{ index + 1 }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-700">{{ m.name }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-500">{{ m.source }}</td>
                    <td class="px-5 py-3.5 text-sm">
                      <button @click="editMember(m)" class="text-[#2D8A4E] hover:text-[#237a3f] mr-2">编辑</button>
                      <button @click="deleteMember(m.id)" class="text-red-500 hover:text-red-600">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <template v-if="activeTab === 'statistics'">
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <div class="flex rounded-lg border border-gray-200 overflow-hidden">
              <button @click="statMode = 'year'; fetchStatistics()" :class="['px-3 py-2 text-sm transition-all', statMode === 'year' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50']">按年</button>
              <button @click="statMode = 'week'; fetchStatistics()" :class="['px-3 py-2 text-sm transition-all', statMode === 'week' ? 'bg-[#2D8A4E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50']">按周</button>
            </div>
            <select v-if="statMode === 'year'" v-model="selectedStatYear" @change="fetchStatistics" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }} 年</option>
            </select>
            <select v-if="statMode === 'week'" v-model="selectedStatWeek" @change="fetchStatistics" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option v-for="w in availableStatWeeks" :key="w.key" :value="w.key">{{ w.label }}</option>
            </select>
            <select v-model="statCheckInFilter" @change="fetchStatistics" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]">
              <option value="">全部报名</option>
              <option value="booked">预约统计</option>
              <option value="scheduled">正常签到</option>
              <option value="walkin">临时签到</option>
            </select>
          </div>

          <div v-if="loadingStatistics" class="text-center py-12">
            <div class="w-8 h-8 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>

          <template v-else>
            <div class="bg-white rounded-xl px-5 py-3 shadow-sm mb-4">
                <div class="text-xs text-gray-400">{{ statMode === 'week' ? '本周' : '全年' }}{{ statCheckInFilter ? (statCheckInFilter === 'booked' ? '预约报名' : statCheckInFilter === 'scheduled' ? '正常签到' : '临时签到') : '报名' }}</div>
                <div class="text-xl font-bold text-[#2D8A4E]">{{ statisticsTotal }} 人次</div>
              </div>

            <div class="bg-white rounded-2xl shadow-sm overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium w-12">排名</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">姓名</th>
                    <th @click="toggleStatSort('source')" class="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="statSortBy === 'source' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      来自 {{ statSortBy === 'source' ? '↓' : '' }}
                    </th>
                    <th @click="toggleStatSort('tuesday')" class="text-center px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="statSortBy === 'tuesday' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      周二 {{ statSortBy === 'tuesday' ? '↓' : '' }}
                    </th>
                    <th @click="toggleStatSort('wednesday')" class="text-center px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="statSortBy === 'wednesday' ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      周三 {{ statSortBy === 'wednesday' ? '↓' : '' }}
                    </th>
                    <th @click="toggleStatSort('total')" class="text-center px-5 py-3 text-xs font-medium cursor-pointer select-none hover:text-gray-600 transition-colors" :class="statSortBy === 'total' || !statSortBy ? 'text-[#2D8A4E]' : 'text-gray-400'">
                      合计 {{ !statSortBy || statSortBy === 'total' ? '↓' : '' }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in statisticsData" :key="item.name" :class="['border-b border-gray-50 hover:bg-gray-50/50 transition-colors', index < 3 ? 'bg-[#2D8A4E]/5' : '']">
                    <td class="px-5 py-3.5 text-sm" :class="index < 3 ? 'font-bold text-[#2D8A4E]' : 'text-gray-400'">{{ index + 1 }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-700">{{ item.name }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-500">{{ item.source }}</td>
                    <td class="px-5 py-3.5 text-sm text-center" :class="item.tuesday_count > 0 ? 'text-gray-500' : 'text-gray-300'">{{ item.tuesday_count }}</td>
                    <td class="px-5 py-3.5 text-sm text-center" :class="item.wednesday_count > 0 ? 'text-gray-500' : 'text-gray-300'">{{ item.wednesday_count }}</td>
                    <td class="px-5 py-3.5 text-sm text-center font-semibold" :class="item.total_count > 0 ? 'text-[#2D8A4E]' : 'text-gray-300'">{{ item.total_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <template v-if="activeTab === 'checkin-review'">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-sm text-gray-500">待审批签到</span>
            <button @click="fetchPendingCheckins" :disabled="loadingPending" class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-all">
              {{ loadingPending ? '刷新中…' : '刷新' }}
            </button>
          </div>

          <div v-if="loadingPending" class="text-center py-12">
            <div class="w-8 h-8 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>

          <template v-else>
            <div v-if="pendingCheckins.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-gray-400 text-sm">暂无待审批的签到申请</p>
            </div>

            <div v-else class="bg-white rounded-2xl shadow-sm overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">姓名</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">上课日</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">类型</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">申请时间</th>
                    <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in pendingCheckins" :key="r.id" class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td class="px-5 py-3.5 text-sm text-gray-700">{{ r.name }}</td>
                    <td class="px-5 py-3.5">
                      <span :class="[
                        'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                        r.classDay === 'tuesday' ? 'bg-[#2D8A4E]/10 text-[#2D8A4E]' : 'bg-[#F5A623]/10 text-[#F5A623]'
                      ]">
                        {{ r.classDay === 'tuesday' ? '周二' : '周三' }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5">
                      <span :class="[
                        'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                        r.checkInTypeLabel === '预约签到' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'
                      ]">
                        {{ r.checkInTypeLabel }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-sm text-gray-400">{{ r.checkInTime }}</td>
                    <td class="px-5 py-3.5 text-sm whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <button
                          @click="approveCheckin(r.id)"
                          :disabled="reviewingCheckin"
                          class="px-3 py-1.5 rounded-lg bg-[#2D8A4E] text-white text-xs hover:bg-[#237a3f] transition-all disabled:opacity-50"
                        >通过</button>
                        <button
                          @click="openRejectModal(r.id)"
                          :disabled="reviewingCheckin"
                          class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-all disabled:opacity-50"
                        >驳回</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </div>
    </template>

    <div v-if="showImportModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-[420px] max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-700">导入报名</h3>
          <a @click="downloadImportTemplate" class="text-xs text-[#2D8A4E] hover:text-[#237a3f] cursor-pointer">下载模板</a>
        </div>
        <p class="text-xs text-gray-400 mb-3">选择 CSV 文件自动填充，或直接粘贴 CSV 文本</p>
        <div class="flex gap-2 mb-3">
          <label class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 hover:bg-gray-100 hover:border-[#2D8A4E] cursor-pointer transition-all">
            <span>📁</span>
            <span>选择 CSV 文件</span>
            <input type="file" accept=".csv" @change="handleImportFile" class="hidden" />
          </label>
        </div>
        <div class="flex-1 overflow-auto mb-4">
          <textarea
            v-model="importContent"
            rows="10"
            placeholder="姓名,手机号,上课日,来源,周次&#10;张三,13800000000,周二,CNCC,2026-W23&#10;李四,13900000000,周三,CFID,2026-W23"
            class="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white resize-none font-mono"
          ></textarea>
        </div>
        <div v-if="importResult" class="mb-3 p-3 rounded-xl text-xs" :class="importResult.imported > 0 ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'">
          <div class="font-semibold mb-1">导入完成：成功 {{ importResult.imported }}/{{ importResult.total }}</div>
          <div v-for="(err, idx) in importResult.errors" :key="idx" class="opacity-80">{{ err }}</div>
        </div>
        <div class="flex gap-3">
          <button @click="doImport" :disabled="importing" class="flex-1 py-2.5 rounded-xl bg-[#2D8A4E] text-white font-medium text-sm hover:bg-[#237a3f] transition-all disabled:opacity-50">
            {{ importing ? '导入中…' : '确认导入' }}
          </button>
          <button @click="closeImportModal" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showWalkInModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">临时签到</h3>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-400 block mb-1">姓名</label>
            <input
              v-model="walkInForm.name"
              @input="checkWalkInMember"
              type="text"
              placeholder="请输入姓名"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
            />
            <p class="text-xs mt-1" :class="walkInMemberFound ? 'text-[#2D8A4E]' : 'text-gray-400'">
              {{ walkInMemberFound ? '小组成员，来源：' + walkInMemberSource : '不在成员清单中，需填写来源' }}
            </p>
          </div>
          <div v-if="!walkInMemberFound">
            <label class="text-xs text-gray-400 block mb-1">来自</label>
            <select
              v-model="walkInForm.source"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
            >
              <option value="CNCC">CNCC</option>
              <option value="CFID">CFID</option>
              <option value="SQQ">SQQ</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-400 block mb-1">上课日</label>
            <select
              v-model="walkInForm.classDay"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
            >
              <option value="tuesday">周二</option>
              <option value="wednesday">周三</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button
            @click="doWalkIn"
            :disabled="walkInProcessing"
            class="flex-1 py-2.5 rounded-xl bg-[#2D8A4E] text-white font-medium text-sm hover:bg-[#237a3f] transition-all disabled:opacity-50"
          >
            {{ walkInProcessing ? '处理中…' : '确认签到' }}
          </button>
          <button @click="closeWalkInModal" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showCancelClassModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">取消课程</h3>
        <div class="space-y-3 mb-4">
          <div
            v-for="day in ['tuesday', 'wednesday']"
            :key="day"
            class="rounded-xl p-4"
            :class="cancelClassData[day] ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium" :class="cancelClassData[day] ? 'text-red-600' : 'text-gray-600'">
                {{ day === 'tuesday' ? '周二' : '周三' }}
              </span>
              <button
                v-if="!cancelClassData[day]"
                @click="startCancelClass(day)"
                class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-all"
              >取消</button>
              <button
                v-else
                @click="removeCancelClass(day)"
                :disabled="cancellingClass"
                class="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-500 text-xs hover:bg-gray-50 transition-all disabled:opacity-50"
              >恢复</button>
            </div>
            <div v-if="cancelClassData[day]" class="text-xs text-red-500">
              原因：{{ cancelClassData[day] }}
            </div>
          </div>
        </div>
        <button @click="showCancelClassModal = false" class="w-full py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">关闭</button>
      </div>
    </div>

    <div v-if="showCancelReasonModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">取消{{ cancelTargetDay === 'tuesday' ? '周二' : '周三' }}课程</h3>
        <div class="mb-4">
          <label class="text-xs text-gray-400 block mb-1">取消原因</label>
          <input
            v-model="cancelReasonInput"
            type="text"
            placeholder="例如：下雨、节假日等"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
            @keyup.enter="confirmCancelClass"
          />
        </div>
        <div class="flex gap-3">
          <button @click="confirmCancelClass" :disabled="cancellingClass" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-all disabled:opacity-50">
            {{ cancellingClass ? '处理中…' : '确认取消' }}
          </button>
          <button @click="showCancelReasonModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showRejectModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">驳回签到申请</h3>
        <div class="mb-4">
          <label class="text-xs text-gray-400 block mb-1">驳回原因</label>
          <input
            v-model="rejectReasonInput"
            type="text"
            placeholder="请填写驳回原因"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
            @keyup.enter="confirmReject"
          />
        </div>
        <div class="flex gap-3">
          <button @click="confirmReject" :disabled="reviewingCheckin" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-all disabled:opacity-50">
            {{ reviewingCheckin ? '处理中…' : '确认驳回' }}
          </button>
          <button @click="showRejectModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        </div>
      </div>
    </div>

    <div v-if="showRescheduleModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 w-80">
        <h3 class="text-lg font-bold text-gray-700 mb-4">调课</h3>
        <p class="text-sm text-gray-500 mb-4">
          将 <span class="font-medium text-gray-700">{{ currentRegistration?.name }}</span> 从
          <span class="font-medium text-gray-700">{{ currentRegistration?.classDay === 'tuesday' ? '周二' : '周三' }}</span> 调整到
        </p>
        <div class="flex gap-3 mb-4">
          <button
            v-if="currentRegistration?.classDay !== 'tuesday'"
            @click="doReschedule('tuesday')"
            :disabled="rescheduling"
            class="flex-1 py-2 rounded-lg border border-[#2D8A4E] text-[#2D8A4E] font-medium text-sm hover:bg-[#2D8A4E]/5 transition-all disabled:opacity-50"
          >
            周二
          </button>
          <button
            v-if="currentRegistration?.classDay !== 'wednesday'"
            @click="doReschedule('wednesday')"
            :disabled="rescheduling"
            class="flex-1 py-2 rounded-lg border border-[#2D8A4E] text-[#2D8A4E] font-medium text-sm hover:bg-[#2D8A4E]/5 transition-all disabled:opacity-50"
          >
            周三
          </button>
        </div>
        <button @click="showRescheduleModal = false" class="w-full py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
      </div>
    </div>
  </div>

  <div v-if="showMemberModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-6 w-80">
      <h3 class="text-lg font-bold text-gray-700 mb-4">{{ isEditingMember ? '编辑成员' : '新增成员' }}</h3>
      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">姓名</label>
          <input
            v-model="memberForm.name"
            type="text"
            placeholder="请输入姓名"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">来自</label>
          <select
            v-model="memberForm.source"
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 outline-none focus:border-[#2D8A4E] focus:bg-white"
          >
            <option value="CNCC">CNCC</option>
            <option value="CFID">CFID</option>
            <option value="SQQ">SQQ</option>
          </select>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button
          @click="saveMember"
          :disabled="savingMember"
          class="flex-1 py-2.5 rounded-xl bg-[#2D8A4E] text-white font-medium text-sm hover:bg-[#237a3f] transition-all disabled:opacity-50"
        >
          {{ savingMember ? '保存中…' : '保存' }}
        </button>
        <button @click="showMemberModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
      </div>
    </div>
  </div>

  <div v-if="showPasswordModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]">
    <div class="bg-white rounded-2xl p-6 w-80">
      <h3 class="text-lg font-bold text-gray-700 mb-4">{{ passwordModalTitle }}</h3>
      <input
        v-model="passwordModalInput"
        type="password"
        placeholder="管理口令"
        class="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#2D8A4E] focus:bg-white mb-4"
        @keyup.enter="confirmPasswordModal"
      />
      <div class="flex gap-3">
        <button @click="cancelPasswordModal" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all">取消</button>
        <button @click="confirmPasswordModal" class="flex-1 py-2.5 rounded-xl bg-[#2D8A4E] text-white font-medium text-sm hover:bg-[#237a3f] transition-all">确认</button>
      </div>
    </div>
  </div>

    </template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const AUTH_KEY = 'tennis_admin_auth'

const authenticated = ref(false)
const adminPassword = ref('')
const loginError = ref('')
const authenticating = ref(false)
const loadingRegistrations = ref(false)
const loadingMembers = ref(false)
const selectedWeek = ref('')
const selectedStatYear = ref(new Date().getFullYear().toString())
const statCheckInFilter = ref('')
const statSortBy = ref('')
const availableYears = ref<string[]>([])
const loadingStatistics = ref(false)
const statisticsData = ref<any[]>([])
const statisticsTotal = ref(0)
const showMemberModal = ref(false)
const isEditingMember = ref(false)
const editingMemberId = ref<number | null>(null)
const memberForm = ref({ name: '', source: 'CNCC' })
const savingMember = ref(false)
const activeTab = ref<'registrations' | 'members' | 'statistics' | 'checkin-review'>('registrations')
const registrations = ref<any[]>([])
const members = ref<any[]>([])
const availableWeeks = ref<string[]>([])
const showRescheduleModal = ref(false)
const currentRegistration = ref<any>(null)
const rescheduling = ref(false)

const tuesdayCount = computed(() => registrations.value.filter(r => r.classDay === 'tuesday').length)
const wednesdayCount = computed(() => registrations.value.filter(r => r.classDay === 'wednesday').length)
const totalCount = computed(() => registrations.value.length)
const pendingCheckinCount = computed(() => registrations.value.filter((r: any) => r.checkInType === 'applied').length)

const forceOpen = ref(false)
const forceOpenReason = ref('')
const forceClose = ref(false)
const forceCloseReason = ref('')
const updatingSetting = ref(false)
const showSettings = ref(false)
const savingCapacity = ref(false)
const clearingRegistrations = ref(false)
const settings = reactive({
  maxTuesday: 10,
  maxWednesday: 10,
  multiDayEnabled: false,
})
const notificationText = ref('')
const savedNotificationText = ref('')
const notificationIsSaved = ref(true)
watch(notificationText, () => {
  notificationIsSaved.value = notificationText.value === savedNotificationText.value
})
let pendingPasswordResolve: ((pwd: string) => void) | null = null
const showPasswordModal = ref(false)
const passwordModalInput = ref('')
const passwordModalTitle = ref('请输入管理口令')

function requestPassword(title?: string): Promise<string> {
  return new Promise((resolve) => {
    passwordModalInput.value = ''
    passwordModalTitle.value = title || '请输入管理口令'
    showPasswordModal.value = true
    pendingPasswordResolve = resolve
  })
}

function confirmPasswordModal() {
  const pwd = passwordModalInput.value.trim()
  if (!pwd) return
  adminPassword.value = pwd
  try { sessionStorage.setItem('tennis_admin_pwd', pwd) } catch {}
  showPasswordModal.value = false
  pendingPasswordResolve?.(pwd)
  pendingPasswordResolve = null
}

function cancelPasswordModal() {
  showPasswordModal.value = false
  pendingPasswordResolve?.('')
  pendingPasswordResolve = null
}

const showNotifSettings = ref(false)
const savingNotif = ref(false)
const notification = ref<{ message: string; type: 'success' | 'error' } | null>(null)
let notificationTimer: ReturnType<typeof setTimeout> | null = null

const registrationSourceFilter = ref('')
const registrationSortBy = ref('')
const memberSourceFilter = ref('')
const memberSortBy = ref('')
const checkingIn = ref(false)
const showWalkInModal = ref(false)
const showImportModal = ref(false)
const importContent = ref('')
const importResult = ref<any>(null)
const importing = ref(false)
const walkInForm = ref({ name: '', source: 'CNCC', classDay: 'tuesday' })
const walkInProcessing = ref(false)
const walkInMemberFound = ref(false)
const walkInMemberSource = ref('')
const showCancelClassModal = ref(false)
const showCancelReasonModal = ref(false)
const cancelTargetDay = ref<'tuesday' | 'wednesday'>('tuesday')
const cancelReasonInput = ref('')
const cancellingClass = ref(false)
const cancelClassData = ref<Record<string, string>>({})
const pendingCheckins = ref<any[]>([])
const loadingPending = ref(false)
const reviewingCheckin = ref(false)
const showRejectModal = ref(false)
const rejectTargetId = ref<number | null>(null)
const rejectReasonInput = ref('')
const statMode = ref<'year' | 'week'>('year')
const selectedStatWeek = ref('')
const availableStatWeeks = ref<{ key: string; label: string }[]>([])

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  if (notificationTimer) clearTimeout(notificationTimer)
  notification.value = { message, type }
  notificationTimer = setTimeout(() => {
    notification.value = null
  }, 4000)
}

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings')
    const data = await res.json()
    forceOpen.value = data.forceOpen
    forceOpenReason.value = data.forceOpenReason || ''
    forceClose.value = data.forceClose
    forceCloseReason.value = data.forceCloseReason || ''
    settings.maxTuesday = data.maxTuesday || 10
    settings.maxWednesday = data.maxWednesday || 10
    settings.multiDayEnabled = data.multiDayEnabled || false
    notificationText.value = data.notificationText || ''
    savedNotificationText.value = notificationText.value
    notificationIsSaved.value = true
  } catch {
  }
}

async function toggleForceOpen() {
  updatingSetting.value = true
  try {
    const newValue = !forceOpen.value
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'force_open', value: String(newValue) }),
    })
    const data = await res.json()
    if (data.success) {
      forceOpen.value = newValue
      if (!newValue) {
        forceOpenReason.value = ''
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'force_open_reason', value: '' }),
        })
      }
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    updatingSetting.value = false
  }
}

async function saveForceOpenReason() {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'force_open_reason', value: forceOpenReason.value }),
  })
  const data = await res.json()
  if (data.success) {
    showNotification('开放原因已保存')
  }
}

async function toggleForceClose() {
  updatingSetting.value = true
  try {
    const newValue = !forceClose.value
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'force_close', value: String(newValue) }),
    })
    const data = await res.json()
    if (data.success) {
      forceClose.value = newValue
      if (!newValue) {
        forceCloseReason.value = ''
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'force_close_reason', value: '' }),
        })
      }
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    updatingSetting.value = false
  }
}

async function saveForceCloseReason() {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'force_close_reason', value: forceCloseReason.value }),
  })
  const data = await res.json()
  if (data.success) {
    showNotification('关闭原因已保存')
  }
}

async function saveCapacitySettings() {
  savingCapacity.value = true
  try {
    await Promise.all([
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'max_tuesday', value: String(settings.maxTuesday) }),
      }),
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'max_wednesday', value: String(settings.maxWednesday) }),
      }),
    ])
    showNotification('容量设置已保存')
  } catch {
    showNotification('保存失败', 'error')
  } finally {
    savingCapacity.value = false
  }
}

async function toggleMultiDay() {
  savingCapacity.value = true
  try {
    const newValue = !settings.multiDayEnabled
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'multi_day_enabled', value: String(newValue) }),
    })
    const data = await res.json()
    if (data.success) {
      settings.multiDayEnabled = newValue
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    savingCapacity.value = false
  }
}

async function handleLogin() {
  if (!adminPassword.value.trim()) {
    loginError.value = '请输入口令'
    return
  }
  loginError.value = ''
  authenticating.value = true
  try {
    const res = await fetch('/api/auth-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      loginError.value = data.message || '口令错误'
      return
    }
    authenticated.value = true
    try {
      sessionStorage.setItem(AUTH_KEY, '1')
      sessionStorage.setItem('tennis_admin_pwd', adminPassword.value.trim())
    } catch {
    }
    generateWeeks()
    generateYears()
    generateStatWeeks()
    selectedStatWeek.value = getCurrentWeekKey()
    fetchRegistrations()
    fetchMembers()
    fetchStatistics()
    fetchSettings()
    fetchPendingCheckins()
  } catch {
    loginError.value = '网络错误，请稍后重试'
  } finally {
    authenticating.value = false
  }
}

function generateWeeks() {
  const weeks: string[] = []
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  let currentWeekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  let currentYear = now.getFullYear()

  for (let i = 3; i >= 0; i--) {
    let weekNum = currentWeekNum - i
    let year = currentYear
    if (weekNum < 1) {
      year--
      const endOfPrevYear = new Date(year, 11, 31)
      const startOfPrevYear = new Date(year, 0, 1)
      const daysInYear = Math.floor((endOfPrevYear.getTime() - startOfPrevYear.getTime()) / (24 * 60 * 60 * 1000))
      weekNum = Math.ceil((daysInYear + startOfPrevYear.getDay() + 1) / 7) + weekNum
    }
    weeks.push(`${year}-W${String(weekNum).padStart(2, '0')}`)
  }
  availableWeeks.value = weeks
  selectedWeek.value = weeks[3]
}

async function fetchRegistrations() {
  loadingRegistrations.value = true
  try {
    const params = new URLSearchParams({ week: selectedWeek.value })
    if (registrationSourceFilter.value) params.set('source', registrationSourceFilter.value)
    if (registrationSortBy.value) params.set('sort', registrationSortBy.value)
    const res = await fetch(`/api/registrations?${params}`)
    const data = await res.json()
    registrations.value = data.registrations
  } catch {
  } finally {
    loadingRegistrations.value = false
  }
}

async function fetchMembers() {
  loadingMembers.value = true
  try {
    const params = new URLSearchParams()
    if (memberSourceFilter.value) params.set('source', memberSourceFilter.value)
    if (memberSortBy.value) params.set('sort', memberSortBy.value)
    const qs = params.toString()
    const res = await fetch(`/api/members${qs ? '?' + qs : ''}`)
    const data = await res.json()
    members.value = data.members
  } catch {
  } finally {
    loadingMembers.value = false
  }
}

function generateYears() {
  const current = new Date().getFullYear()
  const years: string[] = []
  for (let y = 2025; y <= current; y++) {
    years.push(y.toString())
  }
  availableYears.value = years
  selectedStatYear.value = current.toString()
}

function generateStatWeeks() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const beijing = new Date(now.getTime() + (offset + 480) * 60 * 1000)

  const weeks: { key: string; label: string }[] = []
  const seen = new Set<string>()

  for (let i = -12; i <= 4; i++) {
    const d = new Date(beijing)
    d.setDate(d.getDate() + i * 7)

    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

    if (seen.has(key)) continue
    seen.add(key)

    const dayOfWeek = d.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`
    weeks.push({ key, label: `${key}(${fmt(monday)}-${fmt(sunday)})` })
  }

  weeks.sort((a, b) => b.key.localeCompare(a.key))
  availableStatWeeks.value = weeks
}

function getCurrentWeekKey(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const beijing = new Date(now.getTime() + (offset + 480) * 60 * 1000)
  const startOfYear = new Date(beijing.getFullYear(), 0, 1)
  const days = Math.floor((beijing.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `${beijing.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function toggleStatSort(field: string) {
  statSortBy.value = statSortBy.value === field ? '' : field
  fetchStatistics()
}

function toggleRegSort(field: string) {
  registrationSortBy.value = registrationSortBy.value === field ? '' : field
  fetchRegistrations()
}

function toggleMemberSort(field: string) {
  memberSortBy.value = memberSortBy.value === field ? '' : field
  fetchMembers()
}

async function fetchStatistics() {
  loadingStatistics.value = true
  try {
    const params = new URLSearchParams()
    if (statMode.value === 'week' && selectedStatWeek.value) {
      params.set('mode', 'week')
      params.set('week', selectedStatWeek.value)
    } else {
      params.set('mode', 'year')
      params.set('year', selectedStatYear.value)
    }
    if (statCheckInFilter.value) params.set('checkInType', statCheckInFilter.value)
    if (statSortBy.value) params.set('sortBy', statSortBy.value)
    const res = await fetch(`/api/statistics?${params}`)
    const data = await res.json()
    statisticsData.value = data.data
    statisticsTotal.value = data.data.reduce((sum: number, item: any) => sum + item.total_count, 0)
  } catch {
  } finally {
    loadingStatistics.value = false
  }
}

function showReschedule(r: any) {
  currentRegistration.value = r
  showRescheduleModal.value = true
}

async function doReschedule(newDay: 'tuesday' | 'wednesday') {
  if (!currentRegistration.value) return
  rescheduling.value = true
  try {
    const res = await fetch('/api/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: adminPassword.value.trim(),
        id: currentRegistration.value.id,
        newClassDay: newDay,
      }),
    })
    const data = await res.json()
    if (data.success) {
      showRescheduleModal.value = false
      fetchRegistrations()
    } else {
      showNotification(data.message || '调课失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    rescheduling.value = false
  }
}

function exportAll() {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/api/export-all'
  form.target = '_blank'
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'password'
  input.value = adminPassword.value.trim()
  form.appendChild(input)
  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}

function exportThisWeek() {
  window.open(`/api/export?week=${selectedWeek.value}`, '_blank')
}

function downloadTemplate() {
  window.open('/api/members/export-template', '_blank')
}

function exportMembers() {
  window.open('/api/members/export', '_blank')
}

async function importMembers(e: any) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const buffer = await file.arrayBuffer()
    let csv = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (csv.includes('\uFFFD')) {
      csv = new TextDecoder('gbk', { fatal: false }).decode(buffer)
    }
    csv = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = csv.split('\n').filter(l => l.trim())
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      if (cols.length >= 2) {
        const name = cols[0].trim()
        const source = cols[1].trim().toUpperCase()
        if (name && ['CNCC', 'CFID', 'SQQ'].includes(source)) {
          data.push({ name, source })
        }
      }
    }
    const res = await fetch('/api/members/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value.trim(), data }),
    })
    const result = await res.json()
    if (result.success) {
      showNotification(`成功导入 ${result.successCount} 位成员`)
      fetchMembers()
    } else {
      showNotification('导入失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  }
  e.target.value = ''
}

async function deleteMember(id: number) {
  if (!confirm('确定删除该成员吗？')) return
  try {
    const res = await fetch('/api/members/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value.trim(), id }),
    })
    const result = await res.json()
    if (result.success) {
      fetchMembers()
    } else {
      showNotification('删除失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  }
}

function editMember(m: any) {
  isEditingMember.value = true
  editingMemberId.value = m.id
  memberForm.value = { name: m.name, source: m.source }
  showMemberModal.value = true
}

async function saveMember() {
  const { name, source } = memberForm.value
  if (!name.trim()) {
    showNotification('请输入姓名', 'error')
    return
  }
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) {
    showNotification('请输入管理口令', 'error')
    return
  }
  savingMember.value = true
  try {
    const url = isEditingMember.value ? '/api/members/update' : '/api/members/add'
    const body: any = { password: pwd.trim(), name: name.trim(), source }
    if (isEditingMember.value) body.id = editingMemberId.value
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success) {
      showNotification(isEditingMember.value ? '成员已更新' : '成员已添加')
      showMemberModal.value = false
      fetchMembers()
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    savingMember.value = false
  }
}

async function doCheckIn(id: number) {
  if (!confirm('确认该学员已到场签到？')) return
  checkingIn.value = true
  try {
    const res = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value.trim(), id }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('签到成功')
      fetchRegistrations()
    } else {
      showNotification(data.message || '签到失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    checkingIn.value = false
  }
}

function checkWalkInMember() {
  const name = walkInForm.value.name.trim()
  if (!name) {
    walkInMemberFound.value = false
    walkInMemberSource.value = ''
    return
  }
  const found = members.value.find(m => m.name === name)
  walkInMemberFound.value = !!found
  walkInMemberSource.value = found ? found.source : ''
  if (found) walkInForm.value.source = found.source
}

function closeWalkInModal() {
  showWalkInModal.value = false
  walkInForm.value = { name: '', source: 'CNCC', classDay: 'tuesday' }
  walkInMemberFound.value = false
  walkInMemberSource.value = ''
}

async function doWalkIn() {
  const { name, source, classDay } = walkInForm.value
  if (!name.trim()) {
    showNotification('请输入姓名', 'error')
    return
  }
  walkInProcessing.value = true
  try {
    const existingMember = members.value.find(m => m.name === name.trim())
    if (!existingMember) {
      let pwd = adminPassword.value.trim()
      if (!pwd) {
        pwd = await requestPassword()
      }
      if (!pwd.trim()) {
        showNotification('请输入管理口令', 'error')
        walkInProcessing.value = false
        return
      }
      const addRes = await fetch('/api/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd.trim(), name: name.trim(), source }),
      })
      const addData = await addRes.json()
      if (!addData.success) {
        showNotification(addData.message || '添加成员失败', 'error')
        walkInProcessing.value = false
        return
      }
    }
    let pwd = adminPassword.value.trim()
    if (!pwd) {
      pwd = await requestPassword()
    }
    if (!pwd.trim()) {
      showNotification('请输入管理口令', 'error')
      walkInProcessing.value = false
      return
    }
    const res = await fetch('/api/walk-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), name: name.trim(), source, classDay }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('临时签到成功')
      showWalkInModal.value = false
      walkInForm.value = { name: '', source: 'CNCC', classDay: 'tuesday' }
      fetchRegistrations()
      fetchMembers()
    } else {
      showNotification(data.message || '临时签到失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    walkInProcessing.value = false
  }
}

async function openCancelClass() {
  const res = await fetch('/api/status')
  const data = await res.json()
  cancelClassData.value = data.cancellations || {}
  showCancelClassModal.value = true
}

function startCancelClass(day: string) {
  cancelTargetDay.value = day as 'tuesday' | 'wednesday'
  cancelReasonInput.value = ''
  showCancelReasonModal.value = true
}

async function confirmCancelClass() {
  if (!cancelReasonInput.value.trim()) {
    showNotification('请输入取消原因', 'error')
    return
  }
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) {
    showNotification('请输入管理口令', 'error')
    return
  }
  cancellingClass.value = true
  try {
    const res = await fetch('/api/class-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), classDay: cancelTargetDay.value, reason: cancelReasonInput.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('课程已取消')
      showCancelReasonModal.value = false
      cancelClassData.value[cancelTargetDay.value] = cancelReasonInput.value.trim()
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    cancellingClass.value = false
  }
}

async function removeCancelClass(day: string) {
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) {
    showNotification('请输入管理口令', 'error')
    return
  }
  cancellingClass.value = true
  try {
    const res = await fetch('/api/class-cancel/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), classDay: day }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('课程已恢复')
      cancelClassData.value[day] = ''
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    cancellingClass.value = false
  }
}

async function fetchPendingCheckins() {
  loadingPending.value = true
  try {
    const res = await fetch(`/api/registrations?week=${selectedWeek.value}`)
    const data = await res.json()
    pendingCheckins.value = (data.registrations || []).filter((r: any) => r.checkInType === 'applied')
  } catch {
    showNotification('获取待审批列表失败', 'error')
  } finally {
    loadingPending.value = false
  }
}

async function approveCheckin(id: number) {
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) return
  reviewingCheckin.value = true
  try {
    const res = await fetch('/api/checkin-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), registrationId: id, action: 'approve' }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('签到审批通过')
      fetchPendingCheckins()
      fetchRegistrations()
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    reviewingCheckin.value = false
  }
}

function openRejectModal(id: number) {
  rejectTargetId.value = id
  rejectReasonInput.value = ''
  showRejectModal.value = true
}

async function confirmReject() {
  if (!rejectReasonInput.value.trim()) {
    showNotification('请填写驳回原因', 'error')
    return
  }
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) return
  reviewingCheckin.value = true
  try {
    const res = await fetch('/api/checkin-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), registrationId: rejectTargetId.value, action: 'reject', reason: rejectReasonInput.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification('已驳回签到申请')
      showRejectModal.value = false
      fetchPendingCheckins()
      fetchRegistrations()
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    reviewingCheckin.value = false
  }
}

function closeImportModal() {
  showImportModal.value = false
  importContent.value = ''
  importResult.value = null
}

function downloadImportTemplate() {
  window.open('/api/registrations/export-template', '_blank')
}

function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    importContent.value = reader.result as string
    showNotification(`已读取文件：${file.name}（${file.size} 字节）`)
  }
  reader.onerror = () => {
    showNotification('文件读取失败', 'error')
  }
  reader.readAsText(file, 'UTF-8')
  // 允许重复选择同一文件
  input.value = ''
}

async function doImport() {
  if (!importContent.value.trim()) {
    showNotification('请粘贴导入内容', 'error')
    return
  }
  let pwd = adminPassword.value.trim()
  if (!pwd) {
    pwd = await requestPassword()
  }
  if (!pwd.trim()) return
  importing.value = true
  importResult.value = null
  try {
    const res = await fetch('/api/registrations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), content: importContent.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      importResult.value = data
      if (data.imported > 0) {
        showNotification(`成功导入 ${data.imported} 条报名记录`)
        fetchRegistrations()
        if (data.errors.length === 0) {
          closeImportModal()
        }
      }
    } else {
      showNotification(data.message || '导入失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    importing.value = false
  }
}

async function saveNotificationText() {
  savingNotif.value = true
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'notification_text', value: notificationText.value }),
    })
    savedNotificationText.value = notificationText.value
    notificationIsSaved.value = true
    showNotification('通知已保存')
  } catch {
    showNotification('保存失败', 'error')
  } finally {
    savingNotif.value = false
  }
}

async function clearRegistrations(scope: 'all' | 'week') {
  const label = scope === 'all' ? '本年' : '本周'
  if (!confirm(`确定清空${label}报名记录吗？此操作不可恢复！`)) return
  const pwd = await requestPassword()
  if (!pwd.trim()) return
  clearingRegistrations.value = true
  try {
    const res = await fetch('/api/registrations/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd.trim(), scope }),
    })
    const data = await res.json()
    if (data.success) {
      showNotification(data.message)
      fetchRegistrations()
    } else {
      showNotification(data.message || '操作失败', 'error')
    }
  } catch {
    showNotification('网络错误', 'error')
  } finally {
    clearingRegistrations.value = false
  }
}

function goHome() {
  router.push('/')
}

onMounted(async () => {
  try {
    if (sessionStorage.getItem(AUTH_KEY) === '1') {
      authenticated.value = true
      const savedPwd = sessionStorage.getItem('tennis_admin_pwd')
      if (savedPwd) {
        adminPassword.value = savedPwd
      } else {
        const pwdInput = await requestPassword('请输入管理口令以继续操作')
        if (pwdInput && pwdInput.trim()) {
          adminPassword.value = pwdInput.trim()
          sessionStorage.setItem('tennis_admin_pwd', pwdInput.trim())
        }
      }
    }
  } catch {
  }
  if (authenticated.value) {
    generateWeeks()
    generateYears()
    generateStatWeeks()
    selectedStatWeek.value = getCurrentWeekKey()
    fetchRegistrations()
    fetchMembers()
    fetchStatistics()
    fetchSettings()
  }
})

onMounted(() => {
  const interval = setInterval(() => {
    if (activeTab.value === 'registrations') fetchRegistrations()
    if (activeTab.value === 'members') fetchMembers()
    if (activeTab.value === 'checkin-review') fetchPendingCheckins()
  }, 30000)
})

watch(activeTab, (tab) => {
  if (tab === 'registrations') {
    fetchRegistrations()
  } else if (tab === 'members') {
    fetchMembers()
  } else if (tab === 'checkin-review') {
    fetchPendingCheckins()
  } else {
    fetchStatistics()
  }
})
</script>
