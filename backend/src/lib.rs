//! Biblioteca backend compilada a WebAssembly para usar en React.
//! Exponemos funciones simples mediante `wasm-bindgen`.

use wasm_bindgen::prelude::*;

pub mod cajas;
pub mod curves;
pub mod divisores;
pub mod radiador;
pub mod isobaric;
pub mod auto_params;

pub use crate::radiador::*;
pub use crate::isobaric::*;
pub use crate::auto_params::*;
pub use crate::curves::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Suma dos enteros de 32 bits y devuelve el resultado. (Dejamos esta función de prueba)
#[wasm_bindgen]
pub fn suma(a: i32, b: i32) -> i32 {
    a + b
}
