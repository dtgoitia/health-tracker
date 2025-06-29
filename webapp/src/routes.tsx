/**
 * IMPORTANT: if you omit the leading `/`, the path will be relative and
 * therefore appended to the current path
 */
enum Paths {
  root = "/",
  metrics = "/metrics",
  metric = "/metrics/:metricId",
  symptoms = "/symptoms",
  symptomsEditor = "/symptoms/:symptomId",
  settings = "/settings",
  notFound = "/*",
}

export default Paths;
