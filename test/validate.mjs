// A small JSON Schema checker for the package's own schemas (type, required,
// properties, items, enum): enough to keep the sample data honest without a dependency.
export function validate(schema, value, path = '$') {
  const errors = []
  const types = [].concat(schema.type || [])
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? 'number' : typeof v)
  if (types.length && !types.includes(typeOf(value))) return [`${path}: expected ${types.join('|')}, got ${typeOf(value)}`]
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in ${schema.enum.join(', ')}`)
  if (typeOf(value) === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errors.push(`${path}: missing ${k}`)
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in value) errors.push(...validate(sub, value[k], `${path}.${k}`))
  }
  if (typeOf(value) === 'array' && schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}[${i}]`)))
  return errors
}
