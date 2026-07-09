use std::io::{self, Read};
use warden_drift_engine::{evaluate_canary, CanaryInput};

fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    let canary: CanaryInput = serde_json::from_str(&input).expect("invalid canary input");
    let decision = evaluate_canary(&canary);
    println!("{}", serde_json::to_string_pretty(&decision).unwrap());
}
