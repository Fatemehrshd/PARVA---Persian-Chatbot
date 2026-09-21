import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminTable from '../src/components/admin/AdminTable.vue'

describe('AdminTable.vue Component', () => {
  const columns = [
    { key: 'name', label: 'نام مدل' },
    { key: 'provider', label: 'ارائه‌دهنده' },
    { key: 'status', label: 'وضعیت', align: 'center' as const },
  ]

  const items = [
    { id: '1', name: 'GPT-4o', provider: 'OpenAI', status: 'فعال' },
    { id: '2', name: 'Claude 3.5', provider: 'Anthropic', status: 'غیرفعال' },
    { id: '3', name: 'Gemini 1.5 Pro', provider: 'Google', status: 'فعال' },
  ]

  it('renders columns and item rows properly', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
    })

    expect(wrapper.findAll('th').length).toBe(3)
    expect(wrapper.text()).toContain('نام مدل')
    expect(wrapper.text()).toContain('ارائه‌دهنده')
    expect(wrapper.findAll('tbody tr.table-row').length).toBe(3)
    expect(wrapper.text()).toContain('GPT-4o')
    expect(wrapper.text()).toContain('Claude 3.5')
  })

  it('renders custom empty state when items list is empty', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items: [],
        emptyText: 'هیچ موردی یافت نشد',
      },
    })

    expect(wrapper.findAll('tbody tr.table-row').length).toBe(0)
    expect(wrapper.find('.empty-state').text()).toBe('هیچ موردی یافت نشد')
  })

  it('supports custom row slots', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
      slots: {
        row: `<template #row="{ item }">
          <td class="custom-name">{{ item.name }} - تست</td>
          <td>{{ item.provider }}</td>
          <td>{{ item.status }}</td>
        </template>`,
      },
    })

    expect(wrapper.find('.custom-name').exists()).toBe(true)
    expect(wrapper.find('.custom-name').text()).toBe('GPT-4o - تست')
  })

  it('adds data-label attributes to default cells', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
    })

    const firstRowCells = wrapper.findAll('tbody tr.table-row')[0].findAll('td')
    expect(firstRowCells.length).toBe(3)
    columns.forEach((col, index) => {
      expect(firstRowCells[index].attributes('data-label')).toBe(col.label)
    })
  })

  it('supports inline column filtering row and filters items properly', async () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
        searchable: true,
        defaultShowColumnFilters: true,
      },
    })

    expect(wrapper.find('.column-filters-row').exists()).toBe(true)
    const inputs = wrapper.findAll('.col-filter-input')
    expect(inputs.length).toBeGreaterThanOrEqual(1)

    // Filter by name "Claude"
    await inputs[0].setValue('Claude')
    expect(wrapper.findAll('tbody tr.table-row').length).toBe(1)
    expect(wrapper.text()).toContain('Claude 3.5')
    expect(wrapper.text()).not.toContain('GPT-4o')
  })

  it('searches and filters nested fields used by admin tables', async () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns: [
          { key: 'user.email', label: 'ایمیل کاربر' },
          { key: 'plan.name', label: 'طرح' },
        ],
        items: [
          { id: '1', user: { email: 'ali@example.com' }, plan: { name: 'Pro' } },
          { id: '2', user: { email: 'sara@example.com' }, plan: { name: 'Free' } },
        ],
        searchable: true,
        defaultShowColumnFilters: true,
      },
    })

    await wrapper.find('.search-text-input').setValue('sara')
    await new Promise((resolve) => setTimeout(resolve, 260))
    expect(wrapper.findAll('tbody tr.table-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('sara@example.com')
  })

  it('lets server-side tables open column filters from the toolbar', async () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
        searchable: true,
        serverSide: true,
      },
    })

    expect(wrapper.find('.column-filters-row').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-column-filters"]').trigger('click')
    expect(wrapper.find('.column-filters-row').exists()).toBe(true)
  })

  it('supports column sorting on header click', async () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
    })

    const nameHeader = wrapper.findAll('th')[0]
    await nameHeader.trigger('click') // asc
    let rows = wrapper.findAll('tbody tr.table-row')
    expect(rows[0].text()).toContain('Claude 3.5') // C comes before G

    await nameHeader.trigger('click') // desc
    rows = wrapper.findAll('tbody tr.table-row')
    expect(rows[0].text()).toContain('GPT-4o') // G comes after C
  })
})
