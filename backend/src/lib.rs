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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_suma() {
        assert_eq!(suma(2, 2), 4);
    }
}

#[cfg(test)]
fn suma(a: i32, b: i32) -> i32 {
    a + b
}

