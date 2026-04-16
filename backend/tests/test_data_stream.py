import json


def test_ds_text_encodes_as_data_stream_text_line():
    from backend.app.utils.data_stream import ds_text  # noqa: PLC0415

    out = ds_text('hello "world"')
    assert out.endswith(b"\n")
    assert out.startswith(b'0:"')

    # Must be valid JSON after the `0:` prefix.
    line = out.decode("utf-8").strip()
    assert line.startswith("0:")
    payload = json.loads(line[2:])
    assert payload == 'hello "world"'


def test_ds_finish_encodes_as_data_stream_finish_line():
    from backend.app.utils.data_stream import ds_finish  # noqa: PLC0415

    out = ds_finish({"citations": []})
    line = out.decode("utf-8").strip()
    assert line.startswith("d:")

    payload = json.loads(line[2:])
    assert payload == {"citations": []}

