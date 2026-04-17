export type ProductCategory = {
  id: string
  name: string
}

export type GroupItem = {
  descricao: string
  quantidade: number
  unidade_medida: string
  preco_custo: number
  preco_venda: number
  controlar_estoque: boolean
  quantidade_inicial_estoque: number
}

export type ProductItem = {
  id: string
  name: string
  code: string
  type: 'unit' | 'group'
  category_id: string | null
  track_inventory: boolean
  initial_stock_quantity: number | null
  unit_sale_price: number | null
  unit_cost_price: number | null
  notes: string | null
  group_items?: GroupItem[] | null
  product_categories?: ProductCategory | null
}

export type ProductsResponse = {
  items: ProductItem[]
  total: number
  page: number
  page_size: number
}
