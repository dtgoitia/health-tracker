use poem_openapi::Object;

#[derive(Object, Debug)]
pub struct ErrorResponse {
    pub error: String,
}
