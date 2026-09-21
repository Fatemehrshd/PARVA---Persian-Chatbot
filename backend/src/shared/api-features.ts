import { SelectQueryBuilder } from 'typeorm';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * کلاس سراسری و ماژولار ApiFeatures برای مدیریت پیشرفته فیلترها، جستجو، مرتب‌سازی و صفحه‌بندی
 * پشتیبانی کامل از QueryBuilder پایگاه‌داده TypeORM و پردازش آرایه‌های درون‌حافظه
 */
export class ApiFeatures<T extends Record<string, any>> {
  public queryBuilder?: SelectQueryBuilder<T>;
  public queryString: Record<string, any>;
  public alias: string;

  constructor(
    queryOrBuilder?: SelectQueryBuilder<T>,
    queryString: Record<string, any> = {},
    alias = 'entity',
  ) {
    this.queryBuilder = queryOrBuilder;
    this.queryString = queryString || {};
    this.alias = alias;
  }

  /**
   * جستجوی متنی روی چندین فیلد همزمان (LOWER + LIKE)
   */
  search(searchableFields: string[]): this {
    const searchVal = (this.queryString.search || this.queryString.q || '')?.toString().trim();
    if (!searchVal || !this.queryBuilder || !searchableFields.length) return this;

    const q = `%${searchVal.toLowerCase()}%`;
    const selectedField = this.queryString.searchField;
    const fields = selectedField && searchableFields.includes(selectedField)
      ? [selectedField]
      : searchableFields;
    const conditions = fields.map((field, idx) => {
      const fieldPath = field.includes('.') ? field : `${this.alias}.${field}`;
      return `LOWER(CAST(${fieldPath} AS text)) LIKE :searchParam_${idx}`;
    });

    const params: Record<string, string> = {};
    fields.forEach((_, idx) => {
      params[`searchParam_${idx}`] = q;
    });

    this.queryBuilder.andWhere(`(${conditions.join(' OR ')})`, params);
    return this;
  }

  /**
   * فیلتر کردن مقادیر بر اساس فیلدهای مجاز
   */
  filter(allowedFields?: string[]): this {
    if (!this.queryBuilder) return this;

    const reservedKeys = new Set(['page', 'limit', 'search', 'q', 'searchField', 'sortBy', 'sortOrder', 'sort']);
    const keys = allowedFields || Object.keys(this.queryString).filter((k) => !reservedKeys.has(k));

    for (const key of keys) {
      const val = this.queryString[key];
      if (val !== undefined && val !== null && val !== '') {
        const fieldPath = key.includes('.') ? key : `${this.alias}.${key}`;
        const paramName = `filter_${key.replace(/[^a-zA-Z0-9_]/g, '_')}`;

        if (typeof val === 'boolean' || val === 'true' || val === 'false') {
          const boolVal = val === true || val === 'true';
          this.queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: boolVal });
        } else if (!isNaN(Number(val)) && typeof val !== 'string') {
          this.queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: Number(val) });
        } else {
          this.queryBuilder.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: val });
        }
      }
    }
    return this;
  }

  /**
   * مرتب‌سازی داینامیک صعودی / نزولی
   */
  sort(defaultField = 'createdAt', defaultOrder: 'ASC' | 'DESC' = 'DESC'): this {
    if (!this.queryBuilder) return this;

    let field = this.queryString.sortBy || this.queryString.sort || defaultField;
    let order: 'ASC' | 'DESC' = defaultOrder;

    if (typeof field === 'string' && field.startsWith('-')) {
      field = field.substring(1);
      order = 'DESC';
    } else if (this.queryString.sortOrder) {
      const o = String(this.queryString.sortOrder).toUpperCase();
      if (o === 'ASC' || o === 'DESC') {
        order = o;
      }
    }

    const fieldPath = field.includes('.') ? field : `${this.alias}.${field}`;
    this.queryBuilder.orderBy(fieldPath, order);
    return this;
  }

  /**
   * صفحه‌بندی هوشمند پایگاه داده با skip و take
   */
  paginate(defaultLimit = 50): this {
    if (!this.queryBuilder) return this;

    const page = Math.max(1, Number(this.queryString.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(this.queryString.limit) || defaultLimit));
    const skip = (page - 1) * limit;

    this.queryBuilder.skip(skip).take(limit);
    return this;
  }

  /**
   * اجرای نهایی کوئری و بازگرداندن داده‌ها به همراه اطلاعات صفحه‌بندی
   */
  async exec(): Promise<PaginatedResult<T>> {
    if (!this.queryBuilder) {
      throw new Error('QueryBuilder is not defined for ApiFeatures.exec()');
    }

    const page = Math.max(1, Number(this.queryString.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(this.queryString.limit) || 50));
    const [items, total] = await this.queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * متد کمکی استاتیک برای فیلتر، جستجو، مرتب‌سازی و صفحه‌بندی روی آرایه‌های جاوااسکریپت در حافظه
   */
  static applyToArray<T extends Record<string, any>>(
    items: T[],
    queryString: Record<string, any> = {},
    options: {
      searchableFields?: (keyof T | string)[];
      allowedFilterFields?: (keyof T | string)[];
      defaultSortField?: keyof T | string;
      defaultSortOrder?: 'ASC' | 'DESC';
      defaultLimit?: number;
    } = {},
  ): { items: T[]; total: number; page: number; limit: number; totalPages: number } {
    let result = [...items];

    // ۱. جستجوی متنی روی فیلدهای مشخص
    const searchVal = (queryString.search || queryString.q || '')?.toString().trim().toLowerCase();
    if (searchVal && options.searchableFields?.length) {
      const selectedField = queryString.searchField;
      const searchableFields = selectedField && options.searchableFields.includes(selectedField)
        ? [selectedField]
        : options.searchableFields;
      result = result.filter((item) => {
        return searchableFields.some((field) => {
          const val = (item as any)[field];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(searchVal);
        });
      });
    }

    // ۲. فیلتر ستونی / مقداری
    const reservedKeys = new Set(['page', 'limit', 'search', 'q', 'searchField', 'sortBy', 'sortOrder', 'sort']);
    for (const [key, rawVal] of Object.entries(queryString)) {
      if (reservedKeys.has(key) || rawVal === undefined || rawVal === null || rawVal === '') continue;
      if (options.allowedFilterFields && !options.allowedFilterFields.includes(key)) continue;

      result = result.filter((item) => {
        const itemVal = (item as any)[key];
        if (itemVal === undefined || itemVal === null) return false;
        if (typeof itemVal === 'boolean') {
          return itemVal === (rawVal === 'true' || rawVal === true);
        }
        return String(itemVal).toLowerCase().includes(String(rawVal).toLowerCase());
      });
    }

    // ۳. مرتب‌سازی
    let sortField = (queryString.sortBy || queryString.sort || options.defaultSortField || 'createdAt') as string;
    let sortOrder: 'ASC' | 'DESC' = options.defaultSortOrder || 'DESC';
    if (sortField.startsWith('-')) {
      sortField = sortField.substring(1);
      sortOrder = 'DESC';
    } else if (queryString.sortOrder) {
      const o = String(queryString.sortOrder).toUpperCase();
      if (o === 'ASC' || o === 'DESC') sortOrder = o;
    }

    result.sort((a, b) => {
      const valA = (a as any)[sortField];
      const valB = (b as any)[sortField];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (sortOrder === 'ASC') {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    const total = result.length;
    const page = Math.max(1, Number(queryString.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryString.limit) || (options.defaultLimit || 50)));
    const totalPages = Math.ceil(total / limit) || 1;

    const start = (page - 1) * limit;
    const paginatedItems = queryString.page || queryString.limit ? result.slice(start, start + limit) : result;

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
