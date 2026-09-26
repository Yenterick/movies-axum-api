use std::iter::Peekable;
use std::str::Chars;

use serde_json::{Map, Number, Value};

pub fn parse(input: &str) -> Value {
    let mut chars = input.chars().peekable();
    parse_value(&mut chars)
}

fn parse_value(chars: &mut Peekable<Chars>) -> Value {
    skip_whitespace(chars);
    match chars.peek() {
        Some('[') => parse_array(chars),
        Some('{') => parse_object(chars),
        Some('\'') | Some('"') => Value::String(parse_string(chars)),
        _ => parse_scalar(chars),
    }
}

fn skip_whitespace(chars: &mut Peekable<Chars>) {
    while matches!(chars.peek(), Some(c) if c.is_whitespace()) {
        chars.next();
    }
}

fn parse_array(chars: &mut Peekable<Chars>) -> Value {
    chars.next();
    let mut items = Vec::new();
    skip_whitespace(chars);
    if chars.peek() == Some(&']') {
        chars.next();
        return Value::Array(items);
    }
    loop {
        items.push(parse_value(chars));
        skip_whitespace(chars);
        match chars.next() {
            Some(',') => {
                skip_whitespace(chars);
                continue;
            }
            _ => break,
        }
    }
    Value::Array(items)
}

fn parse_object(chars: &mut Peekable<Chars>) -> Value {
    chars.next();
    let mut map = Map::new();
    skip_whitespace(chars);
    if chars.peek() == Some(&'}') {
        chars.next();
        return Value::Object(map);
    }
    loop {
        skip_whitespace(chars);
        let key = parse_string(chars);
        skip_whitespace(chars);
        chars.next();
        skip_whitespace(chars);
        let value = parse_value(chars);
        map.insert(key, value);
        skip_whitespace(chars);
        match chars.next() {
            Some(',') => {
                skip_whitespace(chars);
                continue;
            }
            _ => break,
        }
    }
    Value::Object(map)
}

fn parse_string(chars: &mut Peekable<Chars>) -> String {
    let quote = chars.next().unwrap_or('\'');
    let mut value = String::new();
    for c in chars.by_ref() {
        if c == '\\' {
            continue;
        }
        if c == quote {
            break;
        }
        value.push(c);
    }
    value
}

fn parse_scalar(chars: &mut Peekable<Chars>) -> Value {
    let mut token = String::new();
    while let Some(&c) = chars.peek() {
        if c == ',' || c == '}' || c == ']' {
            break;
        }
        token.push(c);
        chars.next();
    }
    let token = token.trim();
    match token {
        "True" => Value::Bool(true),
        "False" => Value::Bool(false),
        "None" => Value::Null,
        _ => {
            if let Ok(i) = token.parse::<i64>() {
                Value::Number(Number::from(i))
            } else if let Ok(f) = token.parse::<f64>() {
                Number::from_f64(f)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else {
                Value::String(token.to_string())
            }
        }
    }
}
