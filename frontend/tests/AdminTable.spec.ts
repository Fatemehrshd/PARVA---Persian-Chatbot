import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminTable from '../src/components/admin/AdminTable.vue'

describe('AdminTable.vue Component', () => {
  const columns = [
    { key: 'name', label: '??? ???' },
    { key: 'provider', label: '???????????' },
    { key: 'status', label: '?????', align: 'center' as const },
  ]

  const items = [
    { id: '1', name: 'GPT-4o', provider: 'OpenAI', status: '????' },
    { id: '2', name: 'Claude 3.5', provider: 'Anthropic', status: '???????' },
  ]

  it('renders columns and item rows properly', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
    })

    expect(wrapper.findAll('th').length).toBe(3)
    expect(wrapper.text()).toContain('??? ???')
    expect(wrapper.text()).toContain('???????????')
    expect(wrapper.findAll('tbody tr.table-row').length).toBe(2)
    expect(wrapper.text()).toContain('GPT-4o')
    expect(wrapper.text()).toContain('Claude 3.5')
  })

  it('renders custom empty state when items list is empty', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items: [],
        emptyText: '??? ????? ???? ???',
      },
    })

    expect(wrapper.findAll('tbody tr.table-row').length).toBe(0)
    expect(wrapper.find('.empty-state').text()).toBe('??? ????? ???? ???')
  })

  it('supports custom row slots', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        items,
      },
      slots: {
        row: `<template #row="{ item }">
          <td class="custom-name">{{ item.name }} - ??????</td>
          <td>{{ item.provider }}</td>
          <td>{{ item.status }}</td>
        </template>`,
      },
    })

    expect(wrapper.find('.custom-name').exists()).toBe(true)
    expect(wrapper.find('.custom-name').text()).toBe('GPT-4o - ??????')
  })

  it('adds data-label attributes to default cells for mobile card layout', () => {
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
})
