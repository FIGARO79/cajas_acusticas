use std::ops::{Add, AddAssign, Div, Mul, Neg, Sub, SubAssign};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Complex {
    pub re: f64,
    pub im: f64,
}

impl Complex {
    pub const ZERO: Complex = Complex { re: 0.0, im: 0.0 };
    pub const ONE: Complex = Complex { re: 1.0, im: 0.0 };
    pub const I: Complex = Complex { re: 0.0, im: 1.0 };

    #[inline]
    pub fn new(re: f64, im: f64) -> Self {
        Complex { re, im }
    }

    #[inline]
    pub fn from_polar(r: f64, theta_rad: f64) -> Self {
        Complex {
            re: r * theta_rad.cos(),
            im: r * theta_rad.sin(),
        }
    }

    #[inline]
    pub fn norm_sq(&self) -> f64 {
        self.re * self.re + self.im * self.im
    }

    #[inline]
    pub fn norm(&self) -> f64 {
        self.norm_sq().sqrt()
    }

    #[inline]
    pub fn arg(&self) -> f64 {
        self.im.atan2(self.re)
    }

    #[inline]
    pub fn conj(&self) -> Self {
        Complex {
            re: self.re,
            im: -self.im,
        }
    }

    #[inline]
    pub fn inv(&self) -> Self {
        let n = self.norm_sq();
        if n < 1e-30 {
            Complex { re: 1e15, im: 0.0 }
        } else {
            Complex {
                re: self.re / n,
                im: -self.im / n,
            }
        }
    }

    #[inline]
    pub fn exp(&self) -> Self {
        let r = self.re.exp();
        Complex {
            re: r * self.im.cos(),
            im: r * self.im.sin(),
        }
    }

    #[inline]
    pub fn ln(&self) -> Self {
        Complex {
            re: self.norm().max(1e-30).ln(),
            im: self.arg(),
        }
    }
}

impl Add for Complex {
    type Output = Self;
    #[inline]
    fn add(self, rhs: Self) -> Self {
        Complex {
            re: self.re + rhs.re,
            im: self.im + rhs.im,
        }
    }
}

impl Add<f64> for Complex {
    type Output = Self;
    #[inline]
    fn add(self, rhs: f64) -> Self {
        Complex {
            re: self.re + rhs,
            im: self.im,
        }
    }
}

impl AddAssign for Complex {
    #[inline]
    fn add_assign(&mut self, rhs: Self) {
        self.re += rhs.re;
        self.im += rhs.im;
    }
}

impl SubAssign for Complex {
    #[inline]
    fn sub_assign(&mut self, rhs: Self) {
        self.re -= rhs.re;
        self.im -= rhs.im;
    }
}

impl Sub for Complex {
    type Output = Self;
    #[inline]
    fn sub(self, rhs: Self) -> Self {
        Complex {
            re: self.re - rhs.re,
            im: self.im - rhs.im,
        }
    }
}

impl Sub<f64> for Complex {
    type Output = Self;
    #[inline]
    fn sub(self, rhs: f64) -> Self {
        Complex {
            re: self.re - rhs,
            im: self.im,
        }
    }
}

impl Neg for Complex {
    type Output = Self;
    #[inline]
    fn neg(self) -> Self {
        Complex {
            re: -self.re,
            im: -self.im,
        }
    }
}

impl Mul for Complex {
    type Output = Self;
    #[inline]
    fn mul(self, rhs: Self) -> Self {
        Complex {
            re: self.re * rhs.re - self.im * rhs.im,
            im: self.re * rhs.im + self.im * rhs.re,
        }
    }
}

impl Mul<f64> for Complex {
    type Output = Self;
    #[inline]
    fn mul(self, rhs: f64) -> Self {
        Complex {
            re: self.re * rhs,
            im: self.im * rhs,
        }
    }
}

impl Div for Complex {
    type Output = Self;
    #[inline]
    fn div(self, rhs: Self) -> Self {
        let n = rhs.norm_sq();
        if n < 1e-30 {
            Complex { re: 1e15, im: 0.0 }
        } else {
            Complex {
                re: (self.re * rhs.re + self.im * rhs.im) / n,
                im: (self.im * rhs.re - self.re * rhs.im) / n,
            }
        }
    }
}

impl Div<f64> for Complex {
    type Output = Self;
    #[inline]
    fn div(self, rhs: f64) -> Self {
        Complex {
            re: self.re / rhs,
            im: self.im / rhs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_complex_arithmetic() {
        let a = Complex::new(3.0, 4.0);
        let b = Complex::new(1.0, -2.0);

        assert_eq!(a.norm(), 5.0);
        assert_eq!(a + b, Complex::new(4.0, 2.0));
        assert_eq!(a - b, Complex::new(2.0, 6.0));
        assert_eq!(a * b, Complex::new(11.0, -2.0));

        let div = a / b;
        let expected = Complex::new(-1.0, 2.0);
        assert!((div.re - expected.re).abs() < 1e-10);
        assert!((div.im - expected.im).abs() < 1e-10);
    }
}
