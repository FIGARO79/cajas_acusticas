//! Biblioteca backend compilada a WebAssembly para usar en React.
//! Exponemos funciones simples mediante `wasm-bindgen`.
#![allow(clippy::too_many_arguments)]

pub mod auto_params;
pub mod cajas;
pub mod curves;
pub mod divisores;
pub mod isobaric;
pub mod radiador;

pub use crate::auto_params::*;
pub use crate::cajas::*;
pub use crate::curves::*;
pub use crate::divisores::*;
pub use crate::isobaric::*;
pub use crate::radiador::*;

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

