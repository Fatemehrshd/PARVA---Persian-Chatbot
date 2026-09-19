import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PersianDatePicker from '../src/components/ui/PersianDatePicker.vue'
import {
  gregorianToJalali,
  jalaliToGregorian,
  isJalaliLeapYear,
  getDaysInJalaliMonth,
  toPersianDigits,
  formatJalaliDisplay,
} from '../src/lib/jalali'

describe('Jalali Calendar Utilities (jalali.ts)', () => {
  it('converts Gregorian to Jalali correctly', () => {
    // 2026-09-19 -> 1405/06/28
    const j = gregorianToJalali(2026, 9, 19)
    expect(j.jy).toBe(1405)
    expect(j.jm).toBe(6)
    expect(j.jd).toBe(28)

    // Nowruz 2026 -> 1405/01/01 (March 21, 2026)
    const nowruz = gregorianToJalali(2026, 3, 21)
    expect(nowruz.jy).toBe(1405)
    expect(nowruz.jm).toBe(1)
    expect(nowruz.jd).toBe(1)
  })

  it('converts Jalali back to Gregorian correctly', () => {
    const g = jalaliToGregorian(1405, 6, 28)
    expect(g.gy).toBe(2026)
    expect(g.gm).toBe(9)
    expect(g.gd).toBe(19)

    const gNowruz = jalaliToGregorian(1405, 1, 1)
    expect(gNowruz.gy).toBe(2026)
    expect(gNowruz.gm).toBe(3)
    expect(gNowruz.gd).toBe(21)
  })

  it('identifies leap years accurately', () => {
    expect(isJalaliLeapYear(1403)).toBe(false)
    expect(isJalaliLeapYear(1404)).toBe(true)
    expect(isJalaliLeapYear(1405)).toBe(false)
    expect(isJalaliLeapYear(1408)).toBe(true)
  })

  it('returns correct days per month', () => {
    expect(getDaysInJalaliMonth(1405, 1)).toBe(31)
    expect(getDaysInJalaliMonth(1405, 6)).toBe(31)
    expect(getDaysInJalaliMonth(1405, 7)).toBe(30)
    expect(getDaysInJalaliMonth(1405, 11)).toBe(30)
    expect(getDaysInJalaliMonth(1405, 12)).toBe(29) // normal year
    expect(getDaysInJalaliMonth(1404, 12)).toBe(30) // leap year
  })

  it('formats Persian digits and date strings', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵')
    const display = formatJalaliDisplay('2026-09-19T18:30:00.000Z', false)
    expect(display).toContain('۱۴۰۵')
    expect(display).toContain('۲۸')
  })
})

describe('PersianDatePicker Component', () => {
  it('renders input with placeholder when no date is provided', () => {
    const wrapper = mount(PersianDatePicker, {
      props: {
        modelValue: '',
        placeholder: 'انتخاب تاریخ انقضا...',
      },
    })

    expect(wrapper.text()).toContain('انتخاب تاریخ انقضا...')
  })

  it('renders formatted Persian date when modelValue is provided', () => {
    const wrapper = mount(PersianDatePicker, {
      props: {
        modelValue: '2026-09-19T23:59:00.000Z',
      },
    })

    expect(wrapper.text()).toContain('۱۴۰۵')
    expect(wrapper.text()).toContain('۰۶')
  })

  it('opens calendar popover when clicking input trigger', async () => {
    const wrapper = mount(PersianDatePicker, {
      props: {
        modelValue: '2026-09-19T23:59:00.000Z',
      },
    })

    expect(document.body.querySelector('.persian-datepicker-teleport')).toBeNull()

    // Click input trigger to open
    await wrapper.find('.cursor-pointer').trigger('click')
    expect(document.body.querySelector('.persian-datepicker-teleport')).not.toBeNull()

    // Calendar shows month names and weekday headers in teleported portal
    expect(document.body.textContent).toContain('شهریور')
    expect(document.body.textContent).toContain('ش')
    expect(document.body.textContent).toContain('ج')
    expect(document.body.textContent).toContain('ساعت و دقیقه')
  })

  it('emits empty string when clear button is clicked', async () => {
    const wrapper = mount(PersianDatePicker, {
      props: {
        modelValue: '2026-09-19T23:59:00.000Z',
      },
    })

    const clearBtn = wrapper.find('button[title="حذف تاریخ انقضا"]')
    expect(clearBtn.exists()).toBe(true)
    await clearBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')![0][0]).toBe('')
  })
})
