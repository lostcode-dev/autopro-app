export type PersonType = 'pf' | 'pj'

export type Client = {
  id: string
  name: string
  person_type: PersonType
  tax_id: string | null
  email: string | null
  phone: string | null
  mobile_phone: string | null
  birth_date: string | null
  zip_code: string | null
  street: string | null
  address_number: string | null
  address_complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  notes: string | null
  responsible_employees: { employee_id: string }[] | null
}
